import { ES256, digest, generateSalt } from '@sd-jwt/crypto-nodejs';
export { digest, generateSalt, ES256 };

export const createVerifier = async (publicKey) => {
    return {
        verifier: await ES256.getVerifier(publicKey),
    };
};