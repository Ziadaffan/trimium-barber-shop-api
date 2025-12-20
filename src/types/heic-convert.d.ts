declare module 'heic-convert' {
  type HeicConvertFormat = 'JPEG' | 'PNG';

  export interface HeicConvertOptions {
    buffer: Buffer | Uint8Array;
    format: HeicConvertFormat;
    quality?: number;
  }

  export default function heicConvert(options: HeicConvertOptions): Promise<Buffer>;
}

