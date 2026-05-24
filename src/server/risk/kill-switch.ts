export class KillSwitch {
  private engaged = false;
  private reason = "not engaged";

  engage(reason: string): void {
    this.engaged = true;
    this.reason = reason;
  }

  disengage(): void {
    this.engaged = false;
    this.reason = "not engaged";
  }

  getState(): { engaged: boolean; reason: string } {
    return {
      engaged: this.engaged,
      reason: this.reason,
    };
  }
}
