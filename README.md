# n8n-nodes-beyondpresence

> **Currently in BETA and under active development.**

This is an n8n community node for integrating [Beyond Presence](https://docs.bey.dev) — deploy and manage AI-driven video agents directly from your workflows.

## Features

- **Create agent**: Create a video agent and get a ready-to-use call link.
- **Get available avatars**: Fetch available avatars for use.
- **Process webhooks**: Handle and filter webhook events from Beyond Presence.

### Webhook Functionality

The node can process webhook events from BeyondPresence:

1. **Event Types**:
   - **Call Ended**: When a call completes, includes full transcript and analytics
   - **Message**: Real-time message events during calls
   - **All Events**: Process any event type

2. **Filtering Options**:
   - Filter events by multiple agent IDs (comma-separated list)
   - Process only specific event types

3. **Rich Structured Output**:
   - **Call Ended Events**: Comprehensive output including:
     - Call details (duration, sentiment, topic)
     - Full conversation transcript
     - User information
     - Conversation summary with first/last messages
   
   - **Message Events**: Detailed message data including:
     - Message content, sender, and timestamp
     - User information
     - Call context

4. **Data Organization**:
   - Clean, hierarchical data structure for easy access
   - Consistent output format across all event types
   - Original raw data preserved for reference
   - Automatic data normalization and enrichment

**Example Use Cases**:
- HR Interviewing: Process completed interviews and analyze conversation data
- Customer Support: Track sentiment and conversation topics
- Sales: Monitor agent-customer interactions in real-time
- Analytics: Build dashboards of video agent usage and performance

## Installation

Follow the [n8n community node installation guide](https://docs.n8n.io/integrations/community-nodes/installation).

## Credentials

[Create an API key](https://docs.bey.dev/api-key) and configure it in the node credentials.

## Compatibility

Requires n8n v1.39.1 or higher.

## Resources

- [Beyond Presence API docs](https://docs.bey.dev)
- [n8n community nodes docs](https://docs.n8n.io/integrations)
