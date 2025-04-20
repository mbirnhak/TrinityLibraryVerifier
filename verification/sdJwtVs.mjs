import { createVerifier, digest, ES256, generateSalt } from './utils.mjs';
import { SDJwtVcInstance } from '@sd-jwt/sd-jwt-vc';

export const createSdJwt = async (publicKey) => {
    // Create a signer and verifier for issuing and verifying SDJwt credentials
    const { verifier } = await createVerifier(publicKey);

    const config = {
        verifier,
        signAlg: ES256.alg,
        hasher: digest,
        hashAlg: 'sha-256',
        saltGenerator: generateSalt,
    }
    // Initialize the SDJwt instance with the required configuration
    const sdjwt = new SDJwtVcInstance(config);


    // Return an object containing utility methods to interact with SDJwt
    return {
        // Method to validate a given SDJwt credential
        async validateCredential(encodedSDJwt) {
            try {
                return await sdjwt.validate(encodedSDJwt);
            } catch (error) {
                console.error("Error validating: ", error);
                return false;
            }
        },
    };
};