const { v2: cloudinary } = require('cloudinary');

const hasCloudinaryConfig = () => Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

const configureCloudinary = () => {
    if (!hasCloudinaryConfig()) {
        return false;
    }

    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true
    });
    return true;
};

const cloudinaryReady = configureCloudinary();

module.exports = {
    cloudinary,
    cloudinaryReady,
    hasCloudinaryConfig
};
