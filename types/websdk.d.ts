// websdk.d.ts
declare module '@securely.id/websdk' {
  function setDevMode(value: boolean): void;
  function getFees(chainId: string, dappAddr: string): Promise<any>;
  function getGrossAmount(chainId: string, dappAddr: string, amount: number): Promise<any>;
  function getProviders(methodId: string): Promise<any>;
  function securelyCallAutoAuth(method: string, endpoint: string, params: any[], methodId: string): Promise<any>;
  function securelyCall(method: string, endpoint: string, params: any, token?: string): Promise<any>;
  function validateCompliance(chainId: string, sender: string, dAppAddress: string, value: number, data: Object | string, policyVariables: Object | null): Promise<any>;
  function validateUser(chainId: string, dappAddr: string): Promise<any>;
  function showPolicyById(id: string, formatted?: boolean): Promise<any>;
  function showPolicy(chainId: string, dappAddr: string, functionSelector: string | null, formatted?: boolean): Promise<any>;
  function listPolicies(chainId: string, dappAddr: string): Promise<any>;
  function isSCProtected(chainId: string, dappAddr: string): Promise<boolean>;

  export {
    setDevMode,
    getFees,
    getGrossAmount,
    securelyCallAutoAuth,
    securelyCall,
    getProviders,
    validateCompliance,
    validateUser,
    showPolicyById,
    showPolicy,
    listPolicies,
    isSCProtected,
  };
}
