/** Global exposed by media/vendor/lamejs.iife.js (LGPL-3.0, loaded as a separate script). */
declare global {
  interface LamejsMp3Encoder {
    encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
    flush(): Int8Array;
  }

  interface LamejsGlobal {
    Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => LamejsMp3Encoder;
  }

  // eslint-disable-next-line no-var
  var lamejs: LamejsGlobal | undefined;
}

export {};
