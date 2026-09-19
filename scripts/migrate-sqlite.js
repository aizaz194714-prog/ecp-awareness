'use strict';
const path=require('path');
const {DatabaseSync}=require('node:sqlite');
const {Pool}=require('pg');

const databaseUrl=process.env.DATABASE_URL;
if(!databaseUrl)throw new Error('DATABASE_URL is required. Copy .env.example to .env first.');
const runtimeUrl=new URL(databaseUrl);
runtimeUrl.searchParams.delete('sslmode');

const sourcePath=path.join(__dirname,'..','database','voter-awareness.db');
const source=new DatabaseSync(sourcePath,{readOnly:true});
const target=new Pool({connectionString:runtimeUrl.toString(),ssl:process.env.DB_SSL==='false'?false:{rejectUnauthorized:false}});
const tables=[
 {name:'admins',identity:true},
 {name:'participants',identity:true},
 {name:'awareness_progress'},
 {name:'survey_responses',identity:true},
 {name:'game_progress'},
 {name:'quiz_attempts',identity:true},
 {name:'activity_logs',identity:true}
];

function quote(identifier){return `"${identifier.replaceAll('"','""')}"`}

async function main(){
 const client=await target.connect();
 try{
  await client.query('BEGIN');
  const populated=[];
  for(const {name} of tables){const result=await client.query(`SELECT COUNT(*)::int count FROM ${quote(name)}`);if(result.rows[0].count)populated.push(name)}
  if(populated.length)throw new Error(`Target is not empty (${populated.join(', ')}). Import aborted to prevent duplicate or overwritten data.`);
  for(const {name} of tables){
   const rows=source.prepare(`SELECT * FROM ${quote(name)}`).all();
   for(const row of rows){
    const columns=Object.keys(row),values=columns.map(column=>row[column]);
    const placeholders=columns.map((_,index)=>`$${index+1}`).join(',');
    await client.query(`INSERT INTO ${quote(name)} (${columns.map(quote).join(',')}) VALUES (${placeholders})`,values);
   }
   console.log(`${name}: ${rows.length} row(s)`);
  }
  for(const {name,identity} of tables){if(identity)await client.query(`SELECT setval(pg_get_serial_sequence($1,'id'),COALESCE(MAX(id),1),MAX(id) IS NOT NULL) FROM ${quote(name)}`,[name])}
  await client.query('COMMIT');
  console.log('SQLite data migration completed. The source database was not modified.');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release();source.close();await target.end()}
}

main().catch(error=>{console.error(`SQLite migration failed: ${error.message}`);process.exitCode=1});
