export class GraphSubscription {
  constructor(
    readonly id: string,
    readonly resource: string,
    readonly notificationUrl: string,
    readonly lifecycleNotificationUrl: string | undefined,
    readonly expirationDateTime: string,
    readonly changeType: string,
  ) {}
}
