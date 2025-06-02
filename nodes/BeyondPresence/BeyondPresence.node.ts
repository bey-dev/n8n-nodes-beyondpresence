import { 
	ApplicationError, 
	IExecuteFunctions, 
	IHttpRequestMethods,
	INodeExecutionData, 
	INodeType, 
	INodeTypeDescription, 
	NodeConnectionType,
	IDataObject
} from 'n8n-workflow';
import { BaseWebhookData, CallEndedEvent, MessageEvent } from './BeyondPresenceTypes';

/**
 * BeyondPresence node for n8n to interact with Beyond Presence API
 * 
 * This node provides two main ways to interact with the Beyond Presence API:
 * 
 * 1. API Routing (agent and avatar resources):
 *    - Uses programmatic API calls
 *    - Returns raw JSON responses directly from the API
 *    - Supports GET and POST methods with proper authentication
 * 
 * 2. Webhook Processing (webhook resource):
 *    - Manually processes webhook payloads received from Beyond Presence
 *    - Handles different event types like 'call_ended' and 'message'
 *    - Supports filtering by agent ID
 *    - Normalizes data formats for consistent downstream processing
 */
export class BeyondPresence implements INodeType {
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
							
							const requestOptions: IDataObject = {
								method: 'POST' as IHttpRequestMethods,
								baseURL: 'https://api.bey.dev/v1',
								url: '/agent',
								headers: {
									'Accept': 'application/json',
									'Content-Type': 'application/json',
								},
								body: requestBody,
								json: true,
							};
							
							const credentials = await this.getCredentials('beyondPresenceApi');
							
							requestOptions.headers = {
								...requestOptions.headers as object,
								'x-api-key': credentials.apiKey as string,
							};
							
							responseData = await this.helpers.request!(requestOptions);
							
							let formattedResponse = responseData;
							
							if (typeof formattedResponse === 'string') {
								try {
									formattedResponse = JSON.parse(formattedResponse);
								} catch (e) {
									// If it's not valid JSON, leave as is
								}
							}
							
							if (formattedResponse && typeof formattedResponse === 'object' && formattedResponse.id) {
								formattedResponse.call_link = `https://bey.chat/${formattedResponse.id}`;
							}
							
							returnItems.push({
								json: formattedResponse,
								pairedItem: { item: i },
							});
						}
					} else if (resource === 'avatar') {
						if (operation === 'get') {
							const requestOptions: IDataObject = {
								method: 'GET' as IHttpRequestMethods,
								baseURL: 'https://api.bey.dev/v1',
								url: '/avatar',
								headers: {
									'Accept': 'application/json',
									'Content-Type': 'application/json',
								},
								json: true,
							};
							
							const credentials = await this.getCredentials('beyondPresenceApi');
							
							requestOptions.headers = {
								...requestOptions.headers as object,
								'x-api-key': credentials.apiKey as string,
							};
							
							responseData = await this.helpers.request!(requestOptions);
							
							let formattedResponse = responseData;
							
							if (typeof formattedResponse === 'string') {
								try {
									formattedResponse = JSON.parse(formattedResponse);
								} catch (e) {
									// If it's not valid JSON, leave as is
								}
							}
							
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
		
		// Process webhook data
		for (let i = 0; i < items.length; i++) {
			try {
				const operation = this.getNodeParameter('operation', i) as string;
				
				if (operation === 'handleEvent') {
					const eventType = this.getNodeParameter('eventType', i) as string;
					const filterByAgentIds = this.getNodeParameter('filterByAgentIds', i, false) as boolean;
					let agentIds: string[] = [];
					
					if (filterByAgentIds) {
						const agentIdsString = this.getNodeParameter('agentIds', i, '') as string;
						agentIds = agentIdsString.split(',').map(id => id.trim());
					}
					
					const webhookDataRaw = this.getNodeParameter('webhookData', i) as string | object;
					let webhookData: BaseWebhookData;
					
					try {
						if (typeof webhookDataRaw === 'string') {
							webhookData = JSON.parse(webhookDataRaw) as BaseWebhookData;
						} else {
							webhookData = webhookDataRaw as BaseWebhookData;
						}
					} catch (error) {
						throw new ApplicationError(`Invalid webhook data: ${(error as Error).message}`);
					}
					
					if (eventType !== 'all' && webhookData.event_type !== eventType) {
						continue;
					}
					
					// Get agent ID directly from call_data
					const getAgentId = (data: BaseWebhookData): string => {
						return data.call_data?.agentId || '';
					};
					
					if (filterByAgentIds && agentIds.length > 0) {
						const eventAgentId = getAgentId(webhookData);
						if (!eventAgentId || !agentIds.includes(eventAgentId)) {
							continue;
						}
					}
					
					if (webhookData.event_type === 'call_ended') {
						const callEndedEvent = webhookData as CallEndedEvent;
						
						const processedData = {
							call_id: callEndedEvent.call_id || '',
							agent_id: getAgentId(callEndedEvent),
							
							call_details: {
								duration_minutes: typeof callEndedEvent.evaluation?.duration_minutes === 'string' 
									? parseInt(callEndedEvent.evaluation.duration_minutes) 
									: (callEndedEvent.evaluation?.duration_minutes || 0),
								message_count: typeof callEndedEvent.evaluation?.messages_count === 'string'
									? parseInt(callEndedEvent.evaluation.messages_count)
									: (callEndedEvent.evaluation?.messages_count || callEndedEvent.messages?.length || 0),
								topic: callEndedEvent.evaluation?.topic || 'Unknown',
								user_sentiment: callEndedEvent.evaluation?.user_sentiment || 'Unknown',
							},
							
							user: {
								name: callEndedEvent.user_name || 
									(callEndedEvent.call_data && callEndedEvent.call_data.userName) || 
									'Unknown',
							},
							
							call_summary: {
								duration_minutes: typeof callEndedEvent.evaluation?.duration_minutes === 'string' 
									? parseInt(callEndedEvent.evaluation.duration_minutes) 
									: (callEndedEvent.evaluation?.duration_minutes || 0),
								message_count: typeof callEndedEvent.evaluation?.messages_count === 'string'
									? parseInt(callEndedEvent.evaluation.messages_count)
									: (callEndedEvent.evaluation?.messages_count || callEndedEvent.messages?.length || 0),
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
						
						returnItems.push({
							json: processedData,
							pairedItem: { item: i },
						});
					} else if (webhookData.event_type === 'message') {
						const messageEvent = webhookData as MessageEvent;
						
						const processedData = {
							call_id: messageEvent.call_id || '',
							agent_id: getAgentId(messageEvent),
							
							user: {
								name: messageEvent.call_data?.userName || 'Unknown',
							},
							
							message: {
								sender: messageEvent.message?.sender || '',
								content: messageEvent.message?.message || '',
								timestamp: messageEvent.message?.sent_at || '',
							},
							
							call_timing: {
								started_at: messageEvent.call_data?.startedAt || '',
							},
							
							event_type: 'message',
						};
						
						returnItems.push({
							json: processedData,
							pairedItem: { item: i },
						});
					} else {
						// For unknown event types, pass minimal data
						returnItems.push({
							json: {
								event_type: webhookData.event_type || 'unknown',
								call_id: webhookData.call_id || '',
								agent_id: getAgentId(webhookData),
							},
							pairedItem: { item: i },
						});
					}
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
		icon: 'file:logo.svg',
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