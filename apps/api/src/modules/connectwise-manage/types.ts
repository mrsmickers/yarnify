export type Company = {
  id: number;
  identifier: string;
  name: string;
  _info: Record<string, any>; // or define a more specific type if known
};

export type Person = {
  id: number;
  firstName: string;
  lastName: string;
  company: Company;
};
