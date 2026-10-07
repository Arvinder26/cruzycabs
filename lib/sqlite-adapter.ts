import { createClient,type InValue } from "@libsql/client";
import { createClient as createRemoteClient } from "@tursodatabase/serverless/compat";
type QueryResult={columns:string[];rows:Array<Record<string,unknown>|unknown[]>;rowsAffected:number};
type AdapterClient={execute(query:{sql:string;args:InValue[]}):Promise<QueryResult>;batch(queries:Array<{sql:string;args:InValue[]}>,mode:"write"):Promise<QueryResult[]>};

function result<T>(value:QueryResult):D1Result<T> {
  return {success:true,results:value.rows.map(row=>Object.fromEntries(value.columns.map((column,index)=>[column,Array.isArray(row)?row[index]:row[column]]))) as T[],meta:{changes:value.rowsAffected}};
}
class Statement implements D1PreparedStatement {
  constructor(readonly client:AdapterClient,readonly sql:string,readonly args:InValue[]=[]) {}
  bind(...values:unknown[]) { return new Statement(this.client,this.sql,values as InValue[]); }
  async run<T=unknown>() { return result<T>(await this.client.execute({sql:this.sql,args:this.args})); }
  async all<T=Record<string,unknown>>() { return this.run<T>(); }
  async first<T=Record<string,unknown>>() { return (await this.all<T>()).results?.[0]??null; }
}
export function sqliteDatabase(url:string,authToken?:string):D1Database {
  url=url.trim();authToken=authToken?.trim();
  const client:AdapterClient=url.startsWith("file:")?createClient({url,authToken,intMode:"number"}):createRemoteClient({url,authToken});
  return {
    prepare(sql:string) {return new Statement(client,sql);},
    async batch<T=unknown>(statements:D1PreparedStatement[]) {
      const queries=statements.map(statement=>{if(!(statement instanceof Statement)||statement.client!==client)throw new Error("Mixed database batch.");return {sql:statement.sql,args:statement.args};});
      // Write mode makes the whole batch atomic, including conditional updates.
      return (await client.batch(queries,"write")).map(value=>result<T>(value));
    },
  };
}
