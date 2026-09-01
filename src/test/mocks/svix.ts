export class Webhook {
  verify(body: string): unknown {
    return JSON.parse(body);
  }
}
