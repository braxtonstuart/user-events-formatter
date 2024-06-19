import {EventData} from "@azure/event-hubs";
import {AzureEventHubClient} from "@braxtonstuart/btncache-clients";
import {UserEvent, UserEventType} from "@braxtonstuart/btncache-types";
import {app, InvocationContext} from "@azure/functions";

const eventHubClient = new AzureEventHubClient();

export async function userEventFormatter(message: string, context: InvocationContext): Promise<void> {
    const userEventsProducerClient = eventHubClient.getProducer('USER_EVENTS');

    try {
        context.debug(`Received Raw User Event Message:\n${message}`);

        const userEvent: EventData = {
            body: formatUserEvent(message),
            contentType: 'application/json'
        };

        context.debug(`Routing Formatted User Event Message...\n${JSON.stringify(userEvent, null, 2)}`);
        await userEventsProducerClient.enqueueEvent(userEvent);
        context.info(`SUCCESS - Formatted User Event Message Forwarded\n${JSON.stringify(userEvent.body, null, 2)}`);
    } catch (error) {
        context.error(`FAILURE - Formatting or Enqueueing User Event Message\nMessage: ${message}`, error);
        await userEventsProducerClient.close();
        throw error;
    }
}

// EXAMPLE: {"userEvent":"LOGIN", "customerId":"[0700376380]", "salesOrg:"BCAR"}
function formatUserEvent(message: string): UserEvent {
    const messageParts = message.split('"');

    let userEventType: UserEventType = undefined;
    switch (messageParts[3]) {
        case 'LOGIN':
            userEventType = UserEventType.LOGIN;
            break;
        case 'PLACE_ORDER':
            userEventType = UserEventType.PLACE_ORDER;
            break;
        default:
            break;
    }

    const customerIds = messageParts[7].substring(1, messageParts[7].length - 2).split(',')

    const salesOrg = messageParts[10];

    return {
        userEvent: userEventType,
        customerIds: customerIds,
        salesOrg: salesOrg
    };
}

app.eventHub('userEventFormatter', {
    connection: 'AZURE_COMMERCE_USER_EVENTS_EVENT_HUB_CONSUMER_CONNECTION_STRING',
    eventHubName: process.env.AZURE_COMMERCE_USER_EVENTS_EVENT_HUB_NAME,
    consumerGroup: process.env.AZURE_COMMERCE_USER_EVENTS_EVENT_HUB_CONSUMER_GROUP,
    cardinality: 'one',
    handler: userEventFormatter
});