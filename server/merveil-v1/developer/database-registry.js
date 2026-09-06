const providers=[{id:'supabase',name:'Supabase',managed:true,features:['Postgres','Auth','Realtime','Storage','Edge Functions']},{id:'cloudflare-d1',name:'Cloudflare D1',managed:true,features:['SQLite-compatible SQL','Workers integration','Edge data']},{id:'postgresql',name:'PostgreSQL',managed:false,features:['Standard PostgreSQL','Full control']}];
export const databaseCatalog=id=>id?providers.find(p=>p.id===id)||null:providers;
export const recommendedDatabase=({needsRealtime=false,edge=false}={})=>needsRealtime?'supabase':edge?'cloudflare-d1':'supabase';
