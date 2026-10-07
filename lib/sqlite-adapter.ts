import { createClient,type Client,type InValue,type ResultSet } from "@libsql/client";

function result<T>(value:ResultSet):D1Result<T> {
  return {success:true,results:value.rows.map(row=>Object.fromEntries(value.columns.map(column=>[column,row[column]]))) as T[],meta:{changes:value.rowsAffected}};
}
class Statement implements D1PreparedStatement {
  constructor(readonly client:Client,readonly sql:string,readonly args:InValue[]=[]) {}
  bind(...values:unknown[]) { return new Statement(this.client,this.sql,values as InValue[]); }
  async run<T=unknown>() { return result<T>(await this.client.execute({sql:this.sql,args:this.args})); }
  async all<T=Record<string,unknown>>() { return this.run<T>(); }
  async first<T=Record<string,unknown>>() { return (await this.all<T>()).results?.[0]??null; }
}
export function sqliteDatabase(url:string,authToken?:string):D1Database {
  const client=createClient({url,authToken,intMode:"number"});
  return {
    prepare(sql:string) {return new Statement(client,sql);},
    async batch<T=unknown>(statements:D1PreparedStatement[]) {
      const queries=statements.map(statement=>{if(!(statement instanceof Statement)||statement.client!==client)throw new Error("Mixed database batch.");return {sql:statement.sql,args:statement.args};});
      // Write mode makes the whole batch atomic, including conditional updates.
      return (await client.batch(queries,"write")).map(value=>result<T>(value));
    },
  };
}
