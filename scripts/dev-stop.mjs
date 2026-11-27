/**
 * Derruba tudo o que o `npm run dev` deste projeto deixou rodando: o próprio `npm run dev`,
 * o `next dev`, o servidor web do Next (`next-server`) e qualquer processo deste projeto
 * ouvindo na porta 3000. Só mexe em processos cujo diretório de trabalho é a raiz do projeto,
 * então não encosta em outros projetos.
 *
 * Depois derruba o Postgres do Docker **apagando o volume** (`down -v`): todos os dados locais
 * (`ordena_dev` e `ordena_test`) vão embora e o próximo `npm run dev` recria o banco do zero.
 */
import { execFileSync } from 'node:child_process';
import { readlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = process.env.PORT ?? '3000';
const DEV_PROCESS = /(npm run dev(\s|$)|next dev|next start|next-server|\.bin\/next(\s|$))/;

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function listProcesses() {
  return run('ps', ['-eo', 'pid=,ppid=,args='])
    .split('\n')
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, ppid, args]) => ({ pid: Number(pid), ppid: Number(ppid), args }));
}

function cwdOf(pid) {
  try {
    return readlinkSync(`/proc/${pid}/cwd`);
  } catch {
    // macOS não tem /proc.
    const out = run('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn']);
    return out
      .split('\n')
      .find((line) => line.startsWith('n'))
      ?.slice(1);
  }
}

function listeningOnPort() {
  return run('lsof', ['-ti', `tcp:${PORT}`, '-sTCP:LISTEN'])
    .split('\n')
    .filter(Boolean)
    .map(Number);
}

function isAlive(pid) {
  // Zumbi (`Z`): já encerrou, só falta o processo pai coletar. Não conta como vivo.
  const state = run('ps', ['-o', 'stat=', '-p', String(pid)]).trim();
  return state !== '' && !state.startsWith('Z');
}

function signal(pids, name) {
  for (const pid of pids) {
    try {
      process.kill(pid, name);
    } catch {
      // Já saiu.
    }
  }
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

// ---------- saída no terminal (cores só em terminal interativo e sem NO_COLOR) ----------

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (useColor ? `\x1b[${code}m${text}\x1b[0m` : String(text));
const bold = paint('1');
const dim = paint('2');
const red = paint('31');
const green = paint('32');
const yellow = paint('33');
const cyan = paint('36');

const ok = (text) => console.log(`  ${green('✔')} ${text}`);
const warn = (text) => console.log(`  ${yellow('!')} ${text}`);
const fail = (text) => console.error(`  ${red('✖')} ${text}`);
const step = (text) => console.log(`\n${cyan('›')} ${bold(text)}`);

// Nome amigável para o que está sendo encerrado.
function describe(args) {
  if (/^sh -c/.test(args)) return 'shell do npm run dev';
  if (/next-server/.test(args)) return 'servidor web do Next';
  if (/next dev|\.bin\/next/.test(args)) return 'next dev';
  if (/npm run dev/.test(args)) return 'npm run dev';
  return args.slice(0, 60);
}

const startedAt = Date.now();

console.log(`\n${bold('Ordena')} ${dim('· dev:stop')}`);

// ---------- 1. processos ----------

step('Encerrando o servidor de desenvolvimento');

const processes = listProcesses();

// Este próprio comando (e quem o chamou: npm, shell) nunca entra na lista.
const protectedPids = new Set();
for (let pid = process.pid; pid > 1 && !protectedPids.has(pid);) {
  protectedPids.add(pid);
  pid = processes.find((p) => p.pid === pid)?.ppid ?? 0;
}

const targets = new Map();
for (const { pid, args } of processes) {
  if (protectedPids.has(pid) || !DEV_PROCESS.test(args)) continue;
  if (cwdOf(pid) === ROOT) targets.set(pid, describe(args));
}
for (const pid of listeningOnPort()) {
  if (!protectedPids.has(pid) && cwdOf(pid) === ROOT) {
    targets.set(pid, targets.get(pid) ?? `processo na porta ${PORT}`);
  }
}

if (targets.size === 0) {
  ok(dim('Nenhum processo do dev rodando'));
} else {
  const pids = [...targets.keys()];
  signal(pids, 'SIGTERM');

  for (let i = 0; i < 20 && pids.some(isAlive); i++) await sleep(150);

  const stubborn = pids.filter(isAlive);
  if (stubborn.length > 0) {
    signal(stubborn, 'SIGKILL');
    await sleep(300);
  }

  for (const [pid, label] of targets) {
    ok(`${label} ${dim(`(pid ${pid}${stubborn.includes(pid) ? ', forçado' : ''})`)}`);
  }
}

const stillListening = listeningOnPort().filter((pid) => cwdOf(pid) === ROOT);
if (stillListening.length > 0) {
  fail(`A porta ${PORT} continua ocupada pelo(s) pid(s): ${stillListening.join(', ')}`);
  process.exit(1);
}
ok(`Porta ${PORT} livre`);

// ---------- 2. banco ----------

step('Derrubando o Postgres');

try {
  execFileSync('docker', ['compose', '-f', 'infra/compose.yaml', 'down', '-v'], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  ok('Container removido');
  ok('Volume apagado ' + dim('(ordena_dev e ordena_test voltam do zero no próximo npm run dev)'));
} catch (error) {
  fail('Não foi possível derrubar o Postgres. O Docker está rodando?');
  const detail = String(error.stderr ?? '').trim();
  if (detail)
    console.error(
      dim(
        detail
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n'),
      ),
    );
  process.exit(1);
}

const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`\n${green('✔')} ${bold('Tudo parado e banco zerado')} ${dim(`em ${seconds}s`)}\n`);
