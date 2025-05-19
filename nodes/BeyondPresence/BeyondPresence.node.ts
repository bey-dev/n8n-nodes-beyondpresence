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
						name: 'Avatar',
						value: 'avatar',
					},
				],
				default: 'avatar',
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
