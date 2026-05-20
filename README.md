# Rabisca — Desenho colaborativo seguro para crianças

O Rabisca é um aplicativo de desenho interativo em tempo real projetado especificamente para o público infantil e suas famílias. O principal diferencial é a **segurança e privacidade**: não há necessidade de criar contas ou vincular redes sociais. O acesso às salas é feito exclusivamente por meio de um código temporário gerado na hora, garantindo que as crianças joguem apenas com pessoas conhecidas.

---

## ✨ Funcionalidades do MVP

*   **Acesso sem Cadastro:** Basta digitar um apelido e o código da sala para começar.
*   **Quadro Branco em Tempo Real:** Sincronização de traços instantânea entre os jogadores.
*   **Interface Estilo Paint:** Ferramentas simples de desenho (lápis, cores básicas e borracha) ideais para crianças.
*   **Modos de Jogo Iniciais:** Desenho livre, temas e a base estrutural para o Modo História.

---

## 🛠️ Tecnologias Utilizadas

*   **Front-end:** Flutter / React Native *(ajuste aqui conforme sua escolha)*
*   **Back-end:** Node.js com Socket.io (WebSockets)
*   **Armazenamento Temporário:** Redis

---

## ⚠️ Status Atual do Projeto & Avisos Importantes (Leia antes de testar)

Este projeto encontra-se em fase de **comprovação de conceito (MVP / Protótipo)**. Ele foi construído para validar a mecânica do jogo e a experiência do usuário, portanto, **não está pronto para produção** e apresenta limitações conhecidas de infraestrutura:

*   **Problema de Escalabilidade (Limite de Salas):** A arquitetura atual de gerenciamento de salas ainda precisa ser refatorada. O servidor suporta poucas conexões simultâneas; **se houver mais de 3 salas ativas ao mesmo tempo, o servidor cai.**
*   **Instabilidade no Redis:** Foi identificado um bug onde a conexão com o banco de dados Redis cai intermitentemente durante as partidas, o que pode fechar salas ativas de forma inesperada.
*   **Desempenho Geral:** Tirando os gargalos de infraestrutura citados acima, a mecânica de desenho, a lógica dos códigos de acesso e a transmissão dos traços em tempo real via Socket.io estão funcionando perfeitamente dentro de salas isoladas.

---

## 🚀 Próximos Passos (Roadmap de Correções)

1.  **Correção da Persistência do Redis:** Tratar as quedas de conexão do Redis implementando reconexão automática (*retry strategy*).
2.  **Arquitetura de Escalabilidade:** Refatorar a lógica de gerenciamento de salas no Node.js para que o consumo de memória não derrube a aplicação com múltiplos acessos.
3.  **Chat Seguro:** Implementar o sistema de mensagens pré-definidas (emoticons e frases prontas) para eliminar a necessidade de digitação livre.
