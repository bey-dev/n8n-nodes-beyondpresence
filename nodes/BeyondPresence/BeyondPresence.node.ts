import { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

export class BeyondPresence implements INodeType {
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
						routing: {
							request: {
								method: 'POST',
								url: '/agent',
								body: {
									avatar_id: '={{ $parameter.avatarId }}',
									system_prompt: '={{ $parameter.systemPrompt }}',
									name: '={{ $parameter.name }}',
									language: '={{ $parameter.language }}',
									greeting: '={{ $parameter.greeting }}',
									max_session_length_minutes: '={{ $parameter.maxSessionLengthMinutes }}',
									capabilities: '={{ $parameter.capabilities }}',
								},
							},
							output: {
								postReceive: [
									{
										type: 'setKeyValue',
										properties: {
											id: '={{ $responseItem.id }}',
											call_link: '=https://bey.chat/{{ $responseItem.id }}',
										},
									},
								],
							},
						},
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
						routing: {
							request: {
								method: 'GET',
								url: '/avatar',
							},
						},
					},
				],
				default: 'get',
			},
		],
	};
}
