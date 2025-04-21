import { createSdJwt } from './sdJwtVc.mjs'

export class CredentialVerification {
    async initialize(publicKey) {
        this.sdJwtCreator = await createSdJwt(publicKey);
    }

    async verifyCredential(credential) {
        try {
            const result = await this.sdJwtCreator.validateCredential(credential);
            return result;
        } catch (error) {
            console.log("[Credential Issuance Error]: ", error);
            return null;
        }
    }
}