export type PortalParams = {
  fromPortal: boolean;
  username: string;
  color: string;
  speed: number;
  ref: string | null;
};

export type PortalGame = { title: string; url: string; id?: string };

declare global {
  interface Window {
    Portal?: {
      readPortalParams(): PortalParams;
      sendPlayerThroughPortal(targetUrl: string, state?: Partial<PortalParams>): void;
      fetchJamRegistry(): Promise<PortalGame[]>;
      pickPortalTarget(): Promise<PortalGame | null>;
      REGISTRY_URL: string;
    };
  }
}

export {};
