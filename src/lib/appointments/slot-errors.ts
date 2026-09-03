export class SlotTakenError extends Error {
  constructor(message = "That time was just taken — please choose another slot") {
    super(message);
    this.name = "SlotTakenError";
  }
}
