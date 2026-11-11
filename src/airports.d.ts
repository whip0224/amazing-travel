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

export declare const AIRPORTS_BY_COUNTRY: AirportCountryGroup[];
export declare const CURRENCIES: CurrencyItem[];

declare const defaultAirports: { country: string; airports: string[] }[];
export default defaultAirports;
