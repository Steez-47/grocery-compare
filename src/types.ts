export type Retailer='newworld'|'woolworths';
export type Policy=Retailer|'cheapest';
export interface Store{id:string;name:string;address:string;region?:string}
export interface Product{retailer:Retailer;id:string;sku?:string;name:string;brand:string;size:string;barcode:string;image:string;cents:number;regularCents:number|null;member:boolean;offer:string;unit:'each'|'kg';min:number;max:number;step:number;unitPrice:string;available:boolean;restricted:boolean;storeId:string;checkedAt:string;url:string;categories?:string[];tags?:string[];special?:boolean;healthStar?:number|null}
export interface Row{key:string;product:Product;offers:Partial<Record<Retailer,Product>>;equivalent?:boolean}
export interface CategorySource{path:string[];key?:string}
export interface Aisle{id:string;name:string;sources:Record<Retailer,CategorySource>}
export interface Department{id:string;name:string;children:Aisle[]}
export interface Line extends Row{quantity:number;preferred:Policy}
export interface State{version:1;stores:Record<Retailer,Store|null>;loyalty:Record<Retailer,boolean>;basket:Line[];policy:Policy}
export interface Results{products:Product[];total:number;pages:number}
declare global{interface Window{grocery:{load:()=>Promise<State>;save:(s:State)=>Promise<boolean>;stores:(r:Retailer,q:string)=>Promise<Store[]>;departments:(s:State['stores'])=>Promise<Department[]>;search:(r:Retailer,s:Store,q:string,p?:number,f?:boolean,o?:{category?:CategorySource})=>Promise<Results>;openStore:(r:Retailer)=>Promise<unknown>;closeStore:()=>Promise<unknown>;navigate:(a:string)=>Promise<unknown>;transfer:(r:Retailer)=>Promise<{count:number;messages:string[]}>;exportList:()=>Promise<boolean>;onStoreStatus:(cb:(s:{retailer:Retailer|null;url:string;loading:boolean})=>void)=>()=>void}}}
