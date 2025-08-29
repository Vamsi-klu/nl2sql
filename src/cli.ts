#!/usr/bin/env node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { readFile } from 'fs/promises';
import { NL2SQL } from './NL2SQL.js';

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option('prompt', { type: 'string', demandOption: true, desc: 'Natural language question' })
    .option('schema', { type: 'string', desc: 'Path to SQL schema file (CREATE TABLE ...)' })
    .option('json', { type: 'array', desc: 'Load JSON file(s) as table: table=path.json', default: [] })
    .option('execute', { type: 'boolean', default: false, desc: 'Execute SQL against in-memory DB' })
    .help()
    .parse();

  const datasets: Record<string, any[]> = {};
  for (const pair of (argv.json as string[])) {
    const [table, file] = String(pair).split('=');
    if (!table || !file) {
      console.error('Invalid --json value. Use table=path.json');
      process.exit(1);
    }
    const text = await readFile(file, 'utf8');
    const rows = JSON.parse(text);
    if (!Array.isArray(rows)) {
      console.error(`JSON file ${file} must contain an array of objects`);
      process.exit(1);
    }
    datasets[table] = rows;
  }

  const schemaSql = argv.schema ? await readFile(argv.schema, 'utf8') : undefined;
  const nl2sql = new NL2SQL();
  const result = await nl2sql.run({ prompt: argv.prompt!, schemaSql, datasets, execute: argv.execute });

  console.log('--- SQL ---');
  console.log(result.sql);
  console.log('\n--- Explanation ---');
  console.log(result.explanation);
  if (argv.execute) {
    console.log('\n--- Rows ---');
    console.log(JSON.stringify(result.rows, null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

