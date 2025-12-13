import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
  fileBuffer: Buffer,
  mimetype: string = 'image/jpeg',
  folder: string = 'products'
): Promise<{ secure_url: string; public_id: string }> => {
  const base64String = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;

  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder: folder,
      resource_type: 'image',
    });

    console.log(result);

    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (error) {
    throw new Error(`Failed to upload to Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const getImageFromCloudinary = async (public_id: string) => {
  return cloudinary.url(public_id);
};

export const updateImageInCloudinary = async (
  public_id: string,
  fileBuffer: Buffer,
  mimetype: string = 'image/jpeg'
): Promise<{ secure_url: string; public_id: string }> => {
  const base64String = `data:${mimetype};base64,${fileBuffer.toString('base64')}`;

  try {
    const result = await cloudinary.uploader.upload(base64String, {
      public_id: public_id,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
    });

    return { secure_url: result.secure_url, public_id: result.public_id };
  } catch (error) {
    throw new Error(
      `Failed to update image in Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
};

export const deleteFromCloudinary = async (public_id: string) => {
  try {
    await cloudinary.uploader.destroy(public_id);
  } catch (error) {
    throw new Error(`Failed to delete from Cloudinary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default cloudinary;
