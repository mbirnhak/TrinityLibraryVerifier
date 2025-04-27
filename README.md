# TrinityLibraryVerifier
A mock SDJWT VC verifier server for the Trinity College Library.


```env
SECRET_KEY=your_secret_key
WALLET_REDIRECT_URI=your_wallet_redirect_uri
VERIFIER_CALLBACK_URI=http://localhost:5000/callback # Or your own url
LOG_LEVEL=INFO
PUBLIC_KEY={ issuers_public_CrytpoKey }
```

#### Environment Variables

- `SECRET_KEY`: Secret key for Flask sessions - generate a secure random string
- `WALLET_REDIRECT_URI`: URI scheme for the eIDAS wallet app
- `VERIFIER_CALLBACK_URI`: Callback URI that the wallet app will use to send credentials
- `LOG_LEVEL`: Optional. Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
- `PUBLIC_KEY`: Verifiers public key - needed for verifying credential signature