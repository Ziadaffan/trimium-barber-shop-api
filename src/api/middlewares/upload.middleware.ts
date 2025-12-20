import multer from 'multer';
import { Request } from 'express';
import path from 'path';
import heicConvert from 'heic-convert';

const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const originalName = (file.originalname || '').toLowerCase();
  const isHeicByExt = originalName.endsWith('.heic') || originalName.endsWith('.heif');

  if (file.mimetype.startsWith('image/') || isHeicByExt) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const HEIC_MIMETYPES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence']);

const isHeicFile = (file: Express.Multer.File) => {
  const originalName = (file.originalname || '').toLowerCase();
  return HEIC_MIMETYPES.has(file.mimetype) || originalName.endsWith('.heic') || originalName.endsWith('.heif');
};

const convertHeicToJpegInPlace = async (file: Express.Multer.File) => {
  if (!isHeicFile(file)) return;

  const jpegBuffer = await heicConvert({
    buffer: file.buffer,
    format: 'JPEG',
    quality: 0.9,
  });

  file.buffer = jpegBuffer;
  file.size = jpegBuffer.length;
  file.mimetype = 'image/jpeg';

  const parsed = path.parse(file.originalname || 'image.heic');
  file.originalname = `${parsed.name}.jpg`;
};

// Wrap multer so we can normalize HEIC/HEIF to JPEG before controllers run.
export const uploadSingle = (req: Request, res: any, next: any) => {
  upload.single('image')(req, res, async (err: any) => {
    if (err) return next(err);

    try {
      if (req.file) {
        await convertHeicToJpegInPlace(req.file as Express.Multer.File);
      }
      return next();
    } catch (e) {
      return next(e);
    }
  });
};
