import { 
	ApplicationError, 
	IExecuteFunctions, 
	INodeExecutionData, 
	INodeType, 
	INodeTypeDescription, 
	NodeConnectionType,
	IDataObject,
	IWebhookFunctions,
	IWebhookResponseData,
	IHookFunctions,
	JsonObject
} from 'n8n-workflow';
import { BaseWebhookData, CallEndedEvent, MessageEvent, WebhookMessage } from './BeyondPresenceTypes';

const beyondPresenceHelpers = {
	/**
	 * Extracts the agent ID from different possible locations in the webhook data
	 * @param {BaseWebhookData} data - The webhook data to extract the agent ID from
	 * @returns {string} The agent ID or an empty string if not found
	 */
	getAgentId(data: BaseWebhookData): string {
		return data.call_data?.agentId || data.agentId || '';
	},
	
	/**
	 * Parses and normalizes duration minutes from the webhook data
	 * @param {string | number | undefined} duration - The duration value to parse
	 * @returns {number} The normalized duration in minutes as a number
	 */
	parseDurationMinutes(duration: string | number | undefined): number {
		if (typeof duration === 'string') {
			return parseInt(duration);
		}
		return duration || 0;
	},
	
	/**
	 * Parses and normalizes message count from the webhook data
	 * @param {string | number | undefined} count - The message count value to parse
	 * @param {WebhookMessage[] | undefined} messages - The messages array to use as fallback for count
	 * @returns {number} The normalized message count as a number
	 */
	parseMessageCount(count: string | number | undefined, messages: WebhookMessage[] | undefined): number {
		if (typeof count === 'string') {
			return parseInt(count);
		}
		return count || (messages?.length || 0);
	},

	/**
	 * Parses and validates webhook data from raw input
	 * @param {string | object} webhookDataRaw - The raw webhook data to parse
	 * @returns {BaseWebhookData} The parsed webhook data
	 * @throws {ApplicationError} If the webhook data is invalid
	 */
	parseWebhookData(webhookDataRaw: string | object): BaseWebhookData {
		let webhookData: BaseWebhookData;
		
		try {
			if (typeof webhookDataRaw === 'string') {
				try {
					webhookData = JSON.parse(webhookDataRaw) as BaseWebhookData;
				} catch (parseError) {
					throw new ApplicationError(`Invalid webhook JSON: ${(parseError as Error).message}`);
				}
			} else {
				webhookData = webhookDataRaw as BaseWebhookData;
			}
			
			if (!webhookData || typeof webhookData !== 'object') {
				throw new ApplicationError('Invalid webhook data: Must be a valid object');
			}
			
			return webhookData;
		} catch (error) {
			throw new ApplicationError(`Invalid webhook data: ${(error as Error).message}`);
		}
	},

	/**
	 * Processes a 'call_ended' event and converts it to a structured format
	 * @param {CallEndedEvent} callEndedEvent - The call ended event to process
	 * @returns {IDataObject} Structured data with call details, user info, messages, and summary
	 */
	processCallEndedEvent(callEndedEvent: CallEndedEvent): IDataObject {
		const durationMinutes = this.parseDurationMinutes(callEndedEvent.evaluation?.duration_minutes);
		const messageCount = this.parseMessageCount(callEndedEvent.evaluation?.messages_count, callEndedEvent.messages);
		
		return {
			call_id: callEndedEvent.call_id || '',
			agent_id: this.getAgentId(callEndedEvent),
			
			call_details: {
				duration_minutes: durationMinutes,
				message_count: messageCount,
				topic: callEndedEvent.evaluation?.topic || 'Unknown',
				user_sentiment: callEndedEvent.evaluation?.user_sentiment || 'Unknown',
			},
			
			user: {
				name: callEndedEvent.user_name || 
					(callEndedEvent.call_data && callEndedEvent.call_data.userName) || 
					'Unknown',
			},
			
			call_summary: {
				duration_minutes: durationMinutes,
				message_count: messageCount,
				first_message: callEndedEvent.messages && callEndedEvent.messages.length > 0 
					? callEndedEvent.messages[0].message 
					: '',
				last_message: callEndedEvent.messages && callEndedEvent.messages.length > 0 
					? callEndedEvent.messages[callEndedEvent.messages.length - 1].message 
					: '',
				user_sentiment: callEndedEvent.evaluation?.user_sentiment || 'Unknown',
			},
			
			messages: (callEndedEvent.messages || []).map(msg => ({
				sender: msg.sender || '',
				message: msg.message || '',
				timestamp: msg.sent_at || '',
			})),
			
			event_type: 'call_ended',
		};
	},

	/**
	 * Processes a 'message' event and converts it to a structured format
	 * @param {MessageEvent} messageEvent - The message event to process
	 * @returns {IDataObject} Structured data with message details and call context
	 */
	processMessageEvent(messageEvent: MessageEvent): IDataObject {
		return {
			call_id: messageEvent.call_id || '',
			agent_id: this.getAgentId(messageEvent),
			
			user: {
				name: messageEvent.call_data?.userName || 'Unknown',
			},
			
			message: {
				sender: messageEvent.message?.sender || '',
				content: messageEvent.message?.message || '',
				timestamp: messageEvent.message?.sent_at || '',
			},
			
			event_type: 'message',
		};
	},

	/**
	 * Formats API response data for consistent output
	 * @param {unknown} responseData - The raw response data to format
	 * @returns {JsonObject} Formatted response with additional helpful properties like call_link
	 */
	formatResponse(responseData: unknown): JsonObject {
		let formattedResponse: unknown = responseData;
		
		if (typeof formattedResponse === 'string') {
			try {
				formattedResponse = JSON.parse(formattedResponse);
			} catch (e) {
				return { data: formattedResponse as string };
			}
		}
		
		if (!formattedResponse || typeof formattedResponse !== 'object') {
			return { data: formattedResponse as string };
		}
		
		if (formattedResponse && typeof formattedResponse === 'object' && 'id' in formattedResponse) {
			const typedResponse = formattedResponse as {id: string};
			return {
				...(formattedResponse as JsonObject),
				call_link: `https://bey.chat/${typedResponse.id}`,
			};
		}
		
		return formattedResponse as JsonObject;
	},
};

export class BeyondPresence implements INodeType {
	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const webhookPayload = request.body;
		const returnData: INodeExecutionData[] = [];
		
		try {
			if (!webhookPayload) {
				throw new ApplicationError('Missing webhook data');
			}
			
			const webhookData = beyondPresenceHelpers.parseWebhookData(webhookPayload);
			
			if (webhookData.event_type === 'call_ended') {
				const processedData = beyondPresenceHelpers.processCallEndedEvent(webhookData as CallEndedEvent);
				returnData.push({ json: processedData });
			} else if (webhookData.event_type === 'message') {
				const processedData = beyondPresenceHelpers.processMessageEvent(webhookData as MessageEvent);
				returnData.push({ json: processedData });
			} else {
				returnData.push({
					json: {
						event_type: webhookData.event_type || 'unknown',
						call_id: webhookData.call_id || '',
						agent_id: beyondPresenceHelpers.getAgentId(webhookData),
					},
				});
			}
		} catch (error) {
			returnData.push({
				json: {
					error: (error as Error).message,
				},
			});
		}
		
		return { workflowData: [returnData] };
	}

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnItems: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		
		if (resource !== 'webhook') {
			const operation = this.getNodeParameter('operation', 0) as string;
			
			for (let i = 0; i < items.length; i++) {
				try {
					let responseData;
					
					if (resource === 'agent') {
						if (operation === 'create') {
							const requestBody = {
								avatar_id: this.getNodeParameter('avatarId', i),
								system_prompt: this.getNodeParameter('systemPrompt', i),
								name: this.getNodeParameter('name', i),
								language: this.getNodeParameter('language', i),
								greeting: this.getNodeParameter('greeting', i),
								max_session_length_minutes: this.getNodeParameter('maxSessionLengthMinutes', i),
								capabilities: this.getNodeParameter('capabilities', i),
							};
							
							const credentials = await this.getCredentials('beyondPresenceApi');
							
							responseData = await this.helpers.httpRequest({
								method: 'POST',
								url: 'https://api.bey.dev/v1/agent',
								headers: {
									'Accept': 'application/json',
									'Content-Type': 'application/json',
									'x-api-key': credentials.apiKey as string,
								},
								body: requestBody,
								json: true,
							});
							
							const formattedResponse = beyondPresenceHelpers.formatResponse(responseData);
							
							returnItems.push({
								json: formattedResponse,
								pairedItem: { item: i },
							});
						}
					} else if (resource === 'avatar') {
						if (operation === 'get') {
							const credentials = await this.getCredentials('beyondPresenceApi');
							
							responseData = await this.helpers.httpRequest({
								method: 'GET',
								url: 'https://api.bey.dev/v1/avatar',
								headers: {
									'Accept': 'application/json',
									'Content-Type': 'application/json',
									'x-api-key': credentials.apiKey as string,
								},
								json: true,
							});
							
							const formattedResponse = beyondPresenceHelpers.formatResponse(responseData);
							
							returnItems.push({
								json: formattedResponse,
								pairedItem: { item: i },
							});
						}
					}
				} catch (error) {
					if (this.continueOnFail()) {
						returnItems.push({
							json: {
								error: (error as Error).message,
							},
							pairedItem: {
								item: i,
							},
						});
						continue;
					}
					throw error;
				}
			}
			
			return this.prepareOutputData(returnItems);
		}
		
		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				
				if (operation === 'handleEvent') {
					const eventType = this.getNodeParameter('eventType', i) as string;
					const filterByAgentIds = this.getNodeParameter('filterByAgentIds', i, false) as boolean;
					let agentIds: string[] = [];
					
					if (filterByAgentIds) {
						const agentIdsString = this.getNodeParameter('agentIds', i, '') as string;
						if (!agentIdsString || agentIdsString.trim() === '') {
							throw new ApplicationError('Agent IDs required when filtering is enabled');
						}
						agentIds = agentIdsString.split(',').map(id => id.trim());
					}
					
					const webhookDataRaw = this.getNodeParameter('webhookData', i) as string | object;
					
					if (!webhookDataRaw) {
						throw new ApplicationError('Missing webhook data');
					}
					
					const webhookData = beyondPresenceHelpers.parseWebhookData(webhookDataRaw);
					
					if (eventType !== 'all' && webhookData.event_type !== eventType) {
						continue;
					}
					
					const extractedAgentId = beyondPresenceHelpers.getAgentId(webhookData);
					
					if (filterByAgentIds && agentIds.length > 0) {
						if (!extractedAgentId || !agentIds.includes(extractedAgentId)) {
							continue;
						}
					}
					
					let processedData: IDataObject;
					
					if (webhookData.event_type === 'call_ended') {
						processedData = beyondPresenceHelpers.processCallEndedEvent(webhookData as CallEndedEvent);
					} else if (webhookData.event_type === 'message') {
						processedData = beyondPresenceHelpers.processMessageEvent(webhookData as MessageEvent);
					} else {
						processedData = {
							event_type: webhookData.event_type || 'unknown',
							call_id: webhookData.call_id || '',
							agent_id: extractedAgentId,
						};
					}
					
					returnItems.push({
						json: processedData,
						pairedItem: { item: i },
					});
				} else {
					returnItems.push(items[i]);
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnItems.push({
						json: {
							error: (error as Error).message,
						},
						pairedItem: {
							item: i,
						},
					});
					continue;
				}
				throw error;
			}
		}
		
		return this.prepareOutputData(returnItems);
	}
	
	description: INodeTypeDescription = {
		displayName: 'Beyond Presence',
		name: 'beyondPresence',
		icon: { light: 'file:logo.svg', dark: 'file:logo.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Deploy video agents with Beyond Presence',
		defaults: {
			name: 'Beyond Presence',
		},
		inputs: <NodeConnectionType[]>['main'],
		outputs: <NodeConnectionType[]>['main'],
		credentials: [
			{
				name: 'beyondPresenceApi',
				required: true,
			},
		],
		requestDefaults: {
			baseURL: 'https://api.bey.dev/v1',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
		},
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Agent',
						value: 'agent',
					},
					{
						name: 'Avatar',
						value: 'avatar',
					},
					{
						name: 'Webhook',
						value: 'webhook',
					},
				],
				default: 'agent',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['agent'],
					},
				},
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a new agent',
						description: 'Deploy a new agent with configuration',
					},
				],
				default: 'create',
			},
			{
				displayName: 'Avatar ID',
				name: 'avatarId',
				type: 'string',
				// Ege's stock avatar
				// Ref: https://docs.bey.dev/avatars/default
				default: 'b9be11b8-89fb-4227-8f86-4a881393cbdb',
				displayOptions: {
					show: {
						resource: ['agent'],
						operation: ['create'],
					},
				},
				description: 'ID of the avatar to use for the agent',
			},
			{
				displayName: 'System Prompt',
				name: 'systemPrompt',
				type: 'string',
				default: 'You are a helpful assistant.',
				displayOptions: {
					show: {
						resource: ['agent'],
						operation: ['create'],
					},
				},
				description: 'System prompt for the agent',
			},
			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: 'My Agent',
				displayOptions: {
					show: {
						resource: ['agent'],
						operation: ['create'],
					},
				},
				description: 'Name of the agent',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				default: 'en',
				options: [
					{
						name: 'Arabic',
						value: 'ar',
					},
					{
						name: 'Chinese',
						value: 'zh',
					},
					{
						name: 'English',
						value: 'en',
					},
					{
						name: 'French',
						value: 'fr',
					},
					{
						name: 'German',
						value: 'de',
					},
					{
						name: 'Italian',
						value: 'it',
					},
					{
						name: 'Japanese',
						value: 'ja',
					},
					{
						name: 'Korean',
						value: 'ko',
					},
					{
						name: 'Portuguese',
						value: 'pt',
					},
					{
						name: 'Russian',
						value: 'ru',
					},
					{
						name: 'Spanish',
						value: 'es',
					},
				],
				displayOptions: {
					show: {
						resource: ['agent'],
						operation: ['create'],
					},
				},
				description: 'Language for the agent',
			},
			{
				displayName: 'Greeting',
				name: 'greeting',
				type: 'string',
				default: 'Hello, how can I help you today?',
				displayOptions: {
					show: {
						resource: ['agent'],
						operation: ['create'],
					},
				},
				description: 'Greeting message for the agent',
			},
			{
				displayName: 'Max Session Length (Minutes)',
				name: 'maxSessionLengthMinutes',
				type: 'number',
				default: 30,
				displayOptions: {
					show: {
						resource: ['agent'],
						operation: ['create'],
					},
				},
				description: 'Maximum session length in minutes',
			},
			{
				displayName: 'Capabilities',
				name: 'capabilities',
				type: 'multiOptions',
				default: [],
				options: [
					{
						name: 'Webcam Vision',
						value: 'webcam_vision',
						description: 'Enable webcam vision capability for the agent',
					},
				],
				displayOptions: {
					show: {
						resource: ['agent'],
						operation: ['create'],
					},
				},
				description: 'Capabilities of the agent',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['avatar'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						action: 'Get the available avatars',
						description: 'Get the available Avatars',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['webhook'],
					},
				},
				options: [
					{
						name: 'Handle Event',
						value: 'handleEvent',
						action: 'Handle webhook event',
						description: 'Process Beyond Presence webhook events',
					},
				],
				default: 'handleEvent',
			},
			{
				displayName: 'Event Type',
				name: 'eventType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['webhook'],
						operation: ['handleEvent'],
					},
				},
				options: [
					{
						name: 'Call Ended',
						value: 'call_ended',
						description: 'When a call ends',
					},
					{
						name: 'Message',
						value: 'message',
						description: 'When a message is exchanged during a call',
					},
					{
						name: 'All Events',
						value: 'all',
						description: 'Process all event types',
					},
				],
				default: 'all',
				description: 'The event type to process',
			},
			{
				displayName: 'Filter by Agent IDs',
				name: 'filterByAgentIds',
				type: 'boolean',
				displayOptions: {
					show: {
						resource: ['webhook'],
						operation: ['handleEvent'],
					},
				},
				default: false,
				description: 'Whether to filter events by agent IDs',
			},
			{
				displayName: 'Agent IDs',
				name: 'agentIds',
				type: 'string',
				displayOptions: {
					show: {
						resource: ['webhook'],
						operation: ['handleEvent'],
						filterByAgentIds: [true],
					},
				},
				default: '',
				placeholder: 'agent_123,agent_456',
				description: 'Comma-separated list of agent IDs to filter by',
				hint: 'Enter multiple agent IDs separated by commas',
			},
			{
				displayName: 'Webhook Data',
				name: 'webhookData',
				type: 'json',
				displayOptions: {
					show: {
						resource: ['webhook'],
						operation: ['handleEvent'],
					},
				},
				default: '={{ $json.body || $json }}',
				description: 'The webhook payload data. Use $JSON.body for n8n webhooks that contain data in the body property.',
				required: true,
			},
		],
	};
}