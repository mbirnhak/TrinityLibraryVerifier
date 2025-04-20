import { createSdJwt } from './SdJwtVc.mjs'

export class CredentialIssuance {
    async initialize(publicKey) {
        this.sdJwtCreator = await createSdJwt(publicKey);
    }

    async verifyCredential(credential) {
        try {
            const success = await this.sdJwtCreator.validateCredential(credential);
            return success;
        } catch (error) {
            console.log("[Credential Issuance Error]: ", error);
            return null;
        }
    }
}