# Fluxo — Planejador Financeiro Empresarial

Planejador financeiro para empresas: receitas, despesas, lucro, distribuição do lucro, investimentos, projetos futuros, metas, histórico e relatórios (CSV/PDF), com insights gerados a partir dos próprios lançamentos.

Os dados ficam salvos **somente no navegador** (IndexedDB). Não há servidor nem login. Use **Configurações → Baixar backup** com regularidade.

## Comandos

```bash
npm install
npm run dev        # desenvolvimento
npm run test       # testes das regras financeiras
npm run typecheck  # checagem de tipos
npm run build      # build de produção em dist/
```

O build é estático e pode ser publicado em qualquer hospedagem de arquivos (Vercel, Netlify, Cloudflare Pages). `vercel.json` e `public/_redirects` já redirecionam as rotas para `index.html`.

## Como o app se divide

**Empresa** (simples): receitas, despesas, lucro e a divisão do lucro entre você e os sócios.
**Minha carteira**: o que você recebe e quanto gastou, investiu e guardou (projetos e metas).

## Regras financeiras

- Valores guardados em **centavos inteiros** e percentuais em **pontos-base** (10000 = 100%), sem erro de arredondamento.
- **Lucro = receitas − despesas** (só lançamentos confirmados). **Margem = lucro ÷ receita × 100.**
- **Receita**: lance pelo valor total do faturamento e registre os **recebimentos** conforme o dinheiro cai na conta (valores quebrados, parcelas, líquido após taxa). A empresa conta só o que já entrou; o resto aparece como "a receber".
- **Retirada** é o lucro que sai da empresa para você ou para um sócio. Não é despesa: o lucro não muda, só o saldo na empresa.
- **Saldo na empresa = lucro − retiradas.**
- As divisões usam o método do maior resto (as partes somam exatamente o total) e são **versionadas por mês**: mudar percentuais não reescreve meses anteriores.

## Divisão do lucro (empresa)

- Em **Sócios e divisão** você define quanto do lucro é seu, de cada sócio e quanto **fica na empresa** (soma = 100%).
- Cada retirada tem um destinatário (você ou um sócio). A página compara a parte de cada pessoa com o que ela já retirou.
- Sócio com retiradas registradas não pode ser excluído, só arquivado.

## Minha carteira

- Sem regra de porcentagem: você lança o **valor exato** e o app calcula a %.
- **Recebi** = suas retiradas da empresa + outros ganhos (salário, freelance, rendimentos…).
- **Gastei**, **Investi** e **Guardei** são lançados em reais; cada um aparece como % do que você recebeu no período e mês a mês.
- **Guardei** pode ir para um projeto ou meta, ou ficar só guardado.
- **Livre = recebi − gastei − investi − guardei.** Gastos pessoais nunca afetam a empresa.

## Arquitetura

```
src/
  domain/      regras puras e testáveis (dinheiro, períodos, lucro, distribuição, relatórios, insights)
  data/        IndexedDB (Dexie), repositórios, hooks reativos, dados de demonstração
  features/    uma pasta por área (dashboard, receitas, despesas, distribuicao, ...)
  components/  UI base, gráficos e layout
  lib/         cores, rótulos e exportação CSV/PDF
  store/       estado de interface (período, tema, menu)
```

As telas só acessam dados por `data/hooks.ts` → `data/repositories.ts`. Para trocar o armazenamento local por uma API (por exemplo, com login e sincronização entre dispositivos), basta reimplementar os repositórios.
