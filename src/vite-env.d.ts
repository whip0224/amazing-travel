/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare module 'page-flip' {
  export class PageFlip {
    constructor(parentElement: HTMLElement, settings: Record<string, any>);
    loadFromHTML(items: NodeListOf<Element> | HTMLElement[]): void;
    on(event: string, callback: (e: any) => void): void;
    flip(pageNum: number, corner?: string): void;
    turnToPage(pageNum: number): void;
    flipNext(corner?: string): void;
    flipPrev(corner?: string): void;
    getCurrentPageIndex(): number;
    destroy(): void;
  }
}

declare module './airports.js' {
  export interface AirportItem {
    code: string;
    displayCode?: string;
    name: string;
    enName: string;
    terminal: string;
  }

  export interface AirportCountryGroup {
    country: string;
    countryCode: string;
    flag: string;
    airports: AirportItem[];
  }

  export interface CurrencyItem {
    code: string;
    symbol: string;
    flag: string;
    name: string;
    rateFromUSD: number;
  }

  export const AIRPORTS_BY_COUNTRY: AirportCountryGroup[];
  export const CURRENCIES: CurrencyItem[];

  const defaultAirports: { country: string; airports: string[] }[];
  export default defaultAirports;
}
