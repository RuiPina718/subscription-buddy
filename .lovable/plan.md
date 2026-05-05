## Novas opções para a Administração

Atualmente a página `/admin` só permite: listar utilizadores, adicionar/remover admins e eliminar contas. Proponho expandir com várias áreas úteis.

### 1. Painel global de métricas (topo da página)
- Total de receita mensal agregada (MRR) de todas as subscrições ativas
- Receita anual projetada (ARR)
- Média de subscrições por utilizador
- Top 5 serviços mais subscritos (ex: Netflix, Spotify…)
- Distribuição por categoria (gráfico em barras/pizza usando Recharts já instalado)
- Novos utilizadores nos últimos 7 / 30 dias

### 2. Gestão avançada de utilizadores
- **Ver detalhe do utilizador** (modal/drawer): lista completa das subscrições dele, totais, última atividade
- **Reenviar email de confirmação** para contas por confirmar
- **Forçar reset de password** (envia email de recuperação)
- **Suspender / reativar conta** (nova coluna `status` em `profiles` ou usar `banned_until` no auth)
- **Exportar lista de utilizadores em CSV**
- Ordenação clicável nas colunas (gasto mensal, nº subs, data de criação)
- Paginação (quando passar de 50 utilizadores)

### 3. Gestão de categorias por defeito
Atualmente as categorias `is_default = true` são partilhadas por todos os utilizadores, mas só existe RLS para as editar — não há UI.
- Secção dedicada para criar / editar / eliminar categorias por defeito (nome, ícone, cor)
- Preview visual das categorias

### 4. Catálogo de serviços sugeridos
- Gerir a lista de presets em `src/lib/subscription-presets.ts` via base de dados (nova tabela `service_presets`) para que admins possam adicionar serviços populares (logo, preço típico, categoria) sem deploy de código
- Os utilizadores veem-nos ao criar nova subscrição

### 5. Logs de atividade / auditoria
- Nova tabela `admin_audit_log` (quem fez o quê: promoveu admin, eliminou utilizador, etc.)
- Tab "Auditoria" na página admin para consultar histórico

### 6. Configurações globais da app
- Tab "Definições" com flags como: permitir registo público (on/off), moeda por defeito, mensagem de manutenção
- Guardadas numa tabela `app_settings` (key/value)

### 7. Reorganização da UI
- Converter a página admin em **abas** (`Tabs` do shadcn): **Visão geral · Utilizadores · Categorias · Serviços · Auditoria · Definições**
- Mantém a página leve e organizada à medida que crescem as funcionalidades

---

### Detalhes técnicos

**Novas tabelas / migrações** (apenas para as áreas que avançares):
- `admin_audit_log (id, actor_id, action, target_id, metadata jsonb, created_at)` + RLS só admins lêem
- `service_presets (id, name, category_id, default_amount, currency, billing_cycle, icon, color, created_at)` + RLS público SELECT, admin INSERT/UPDATE/DELETE
- `app_settings (key text PK, value jsonb, updated_at, updated_by)` + RLS admins

**Novas RPC SECURITY DEFINER:**
- `admin_get_user_subscriptions(_user_id uuid)`
- `admin_resend_confirmation(_user_id uuid)` (usa `supabaseAdmin` num server function em vez de RPC)
- `admin_send_password_reset(_email text)` (idem)
- `admin_set_user_banned(_user_id uuid, _banned bool)` via `auth.admin.updateUserById`
- `admin_global_stats()` retorna MRR/ARR/contagens

**Server functions** em `src/server/admin.functions.ts` para as ações que precisam do `supabaseAdmin` (reset password, suspender, reenviar confirmação).

**Componentes**:
- `src/routes/_app/admin.tsx` reescrito com `<Tabs>`
- `src/components/admin/OverviewTab.tsx` (gráficos Recharts)
- `src/components/admin/UsersTab.tsx` (a tabela atual + ações novas + drawer detalhe)
- `src/components/admin/CategoriesTab.tsx`
- `src/components/admin/PresetsTab.tsx`
- `src/components/admin/AuditTab.tsx`
- `src/components/admin/SettingsTab.tsx`

---

### Como avançar

Diz-me **quais destas áreas queres** (podem ser todas, ou só algumas para começar). Sugestão de prioridade:
1. Visão geral com métricas + gráficos (alto impacto, baixo risco)
2. Detalhe do utilizador + ações (reset password, suspender, reenviar confirmação)
3. Gestão de categorias por defeito
4. Auditoria
5. Catálogo de serviços e Definições globais
