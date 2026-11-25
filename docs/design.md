# Design do Ordena

Direção visual: **sóbria e utilitária, no espírito do GitHub (Primer)**. Fundo neutro, bordas finas em vez de sombras, cor só onde carrega significado (status, prioridade, ação principal). Este arquivo é a fonte da estética do app.

As cores abaixo são inspiradas na paleta do GitHub (tema claro e escuro). Elas são nossas: se mudarem, atualize este arquivo e o `globals.css` juntos.

## Tokens semânticos

Use sempre o token, nunca o hex solto no componente.

| Token                | Claro     | Escuro      | Uso                                      |
| -------------------- | --------- | ----------- | ---------------------------------------- |
| `background`         | `#ffffff` | `#0d1117`   | Fundo da página                          |
| `surface`            | `#f6f8fa` | `#151b23`   | Cards, barra inferior, campos            |
| `border`             | `#d1d9e0` | `#3d444d`   | Bordas e divisórias (1px)                |
| `foreground`         | `#1f2328` | `#f0f6fc`   | Texto principal                          |
| `muted`              | `#59636e` | `#9198a1`   | Texto secundário, placeholders           |
| `accent`             | `#0969da` | `#4493f8`   | Links, foco, item ativo da navegação     |
| `accent-subtle`      | `#ddf4ff` | `#388bfd1a` | Fundo de destaque suave (selecionado)    |
| `primary`            | `#1f883d` | `#238636`   | Botão de ação principal (verde GitHub)   |
| `primary-foreground` | `#ffffff` | `#ffffff`   | Texto sobre `primary`                    |
| `success`            | `#1a7f37` | `#3fb950`   | Concluído, sucesso                       |
| `success-subtle`     | `#dafbe1` | `#2ea64326` | Fundo de selo/aviso de sucesso           |
| `attention`          | `#9a6700` | `#d29922`   | Em andamento, prioridade média, atenção  |
| `attention-subtle`   | `#fff8c5` | `#bb800926` | Fundo de selo/aviso de atenção           |
| `danger`             | `#d1242f` | `#f85149`   | Erro, prioridade alta, ações destrutivas |
| `danger-subtle`      | `#ffebe9` | `#f851491a` | Fundo de selo/aviso de erro              |
| `done`               | `#8250df` | `#ab7df8`   | Reservado (ex.: convite aceito)          |
| `done-subtle`        | `#fbefff` | `#a371f71a` | Fundo de selo do `done`                  |

O tema escuro segue `prefers-color-scheme` (sem alternância manual por enquanto).

## Cores com significado de domínio

| Domínio             | Valor     | Token       |
| ------------------- | --------- | ----------- |
| Tarefa `TODO`       | A fazer   | `muted`     |
| Tarefa `DOING`      | Fazendo   | `attention` |
| Tarefa `DONE`       | Feita     | `success`   |
| Prioridade `LOW`    | Baixa     | `muted`     |
| Prioridade `MEDIUM` | Média     | `attention` |
| Prioridade `HIGH`   | Alta      | `danger`    |
| Convite `PENDING`   | Pendente  | `accent`    |
| Convite `ACCEPTED`  | Aceito    | `success`   |
| Convite `DECLINED`  | Recusado  | `danger`    |
| Convite `CANCELED`  | Cancelado | `muted`     |

Selo (badge) = texto na cor + fundo `*-subtle` + borda de 1px na mesma cor com baixa opacidade. Nunca comunique estado só pela cor: acompanhe de texto ou ícone.

## Regras

- **Contraste:** texto normal ≥ 4,5:1 sobre o fundo. `muted` só para texto secundário, nunca para conteúdo essencial. Os pares acima foram escolhidos a partir do Primer, que já atende; confira ao criar combinações novas.
- **Ação principal:** um único botão `primary` (verde) por tela. Ações secundárias usam `surface` + `border`. Destrutivas usam `danger` e pedem confirmação.
- **Foco:** anel de 2px em `accent` com deslocamento; nunca remova o outline sem substituto.
- **Sem sombras pesadas e sem gradientes.** Hierarquia por borda, espaçamento e peso de fonte. Raio de borda: 6px em campos e botões, 12px em cards.
- **Tipografia:** pilha de sistema (`system-ui`, `-apple-system`, `Segoe UI`, `Roboto`), como já está no `globals.css`. Corpo 16px (evita zoom automático do iOS em inputs).
- **PWA:** `theme_color` do `manifest.js` e a meta `theme-color` devem usar `background` (claro `#ffffff`, escuro `#0d1117`) para a barra do sistema não destoar do app.

## Como aplicar no código (Tailwind v4)

Defina os tokens como variáveis CSS em `src/app/globals.css` e exponha-os em `@theme inline`, para usar `bg-surface`, `text-muted`, `border-border` etc.:

```css
:root {
  --background: #ffffff;
  --surface: #f6f8fa;
  --border: #d1d9e0;
  --foreground: #1f2328;
  --muted: #59636e;
  --accent: #0969da;
  --primary: #1f883d;
  --success: #1a7f37;
  --attention: #9a6700;
  --danger: #d1242f;
  /* ...demais tokens da tabela */
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0d1117;
    --surface: #151b23;
    --border: #3d444d;
    --foreground: #f0f6fc;
    --muted: #9198a1;
    --accent: #4493f8;
    --primary: #238636;
    --success: #3fb950;
    --attention: #d29922;
    --danger: #f85149;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-border: var(--border);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-accent: var(--accent);
  --color-primary: var(--primary);
  --color-success: var(--success);
  --color-attention: var(--attention);
  --color-danger: var(--danger);
}
```
