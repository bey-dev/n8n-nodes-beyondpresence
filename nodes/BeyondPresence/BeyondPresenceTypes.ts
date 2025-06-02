/**
 * Type definitions for Beyond Presence API
 */

/**
 * Represents a message in a conversation
 */
export interface WebhookMessage {
  sender: string;
  message: string;
  sent_at: string;
}

/**
 * Call data containing user and agent information
 */
export interface CallData {
  userName?: string;
  agentId?: string;
  startedAt?: string;
  endedAt?: string;
  leftAt?: string;
}

/**
 * Message event webhook data
 */
export interface MessageEvent {
  event_type: "message";
  call_id: string;
  message: {
    sender: string;
    message: string;
    sent_at: string;
  };
  call_data: CallData;
}

/**
 * Call ended event webhook data
 */
export interface CallEndedEvent {
  event_type: "call_ended";
  call_id: string;
  evaluation: {
    topic?: string;
    user_sentiment?: string;
    duration_minutes: number | string;
    messages_count?: number | string;
  };
  messages: WebhookMessage[];
  user_name?: string;
  agentId?: string;
  call_data?: CallData;
  sentiment_disclaimer?: string;
}

/**
 * Base interface for all webhook events
 */
export interface BaseWebhookData {
  event_type?: string;
  agentId?: string;
  call_id?: string;
  call_data?: CallData;
  evaluation?: {
    topic?: string;
    user_sentiment?: string;
    duration_minutes?: number | string;
    messages_count?: number | string;
    [key: string]: unknown;
  };
  message?: WebhookMessage | Record<string, unknown>;
  messages?: WebhookMessage[];
  user_name?: string;
  sentiment_disclaimer?: string;
}

/**
 * Union type of all event types
 */
export type WebhookData = MessageEvent | CallEndedEvent | BaseWebhookData;

/**
 * Processed message from a call
 */
export interface ProcessedMessage {
  sender: string;
  message: string;
  timestamp: string;
}

/**
 * Call details for a completed call
 */
export interface CallDetails {
  duration_minutes: number;
  message_count: number;
  topic: string;
  user_sentiment: string;
}

/**
 * Summary of a completed call
 */
export interface CallSummary {
  duration_minutes: number;
  message_count: number;
  first_message: string;
  last_message: string;
  user_sentiment: string;
}

/**
 * User information
 */
export interface UserInfo {
  name: string;
}