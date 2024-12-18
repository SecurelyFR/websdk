// websdk.d.ts
declare module '@securely.id/websdk' {
  function setBackendUrl(url: string): void;
  function setAuthUrl(url: string): void;
  function setDevMode(): void;
  function getProviders(chainId: number, dappAddr: string, functionSelector?: string): Promise<any>;
  function securelyCallAutoAuth(method: string, endpoint: string, params: any[], chainId: number, dAppAddress: string, functionSelector: string): Promise<any>;
  function securelyCall(method: string, endpoint: string, params: any, token?: string): Promise<any>;
  function validateCompliance(chainId: string, sender: string, dAppAddress: string, value: number, data: Object | string, policyVariables: Object | null): Promise<any>;
  function validateUser(chainId: string, dappAddr: string): Promise<any>;
  function showPolicy(chainId: string, dappAddr: string, functionSelector?: string, formatted?: boolean): Promise<any>;
  function listPolicies(chainId: string, dappAddr: string): Promise<any>;
  function isSCProtected(chainId: string, dappAddr: string): Promise<boolean>;

  export {
    setBackendUrl,
    setAuthUrl,
    setDevMode,
    securelyCallAutoAuth,
    securelyCall,
    getProviders,
    validateCompliance,
    validateUser,
    showPolicy,
    listPolicies,
    isSCProtected,
  };
}
