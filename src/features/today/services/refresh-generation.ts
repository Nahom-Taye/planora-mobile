export class RefreshGeneration {
  private generation = 0;

  begin() {
    const generation = ++this.generation;
    return () => generation === this.generation;
  }

  invalidate() {
    this.generation++;
  }
}
