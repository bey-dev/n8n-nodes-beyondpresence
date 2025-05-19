import { IAuthenticateGeneric, ICredentialType, INodeProperties } from 'n8n-workflow';

export class BeyondPresenceApi implements ICredentialType {
	name = 'beyondPresenceApi';
	displayName = 'Beyond Presence API';
	documentationUrl = 'https://docs.bey.dev';
	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'x-api-key': '={{$credentials.apiKey}}',
			},
		},
	};
}
