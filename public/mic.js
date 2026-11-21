class Microphone extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Int16Array(2048);
    this.i = 0;
  }
  process(inputs) {
    const samples = inputs[0]?.[0];
    if (samples)
      for (const v of samples) {
        this.chunk[this.i++] = Math.round(Math.max(-1, Math.min(1, v)) * 32767);
        if (this.i === this.chunk.length) {
          this.port.postMessage(this.chunk.buffer, [this.chunk.buffer]);
          this.chunk = new Int16Array(2048);
          this.i = 0;
        }
      }
    return true;
  }
}
registerProcessor("microphone", Microphone);
