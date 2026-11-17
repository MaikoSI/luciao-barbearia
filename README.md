# Lúcião Barbearia

Site de uma página para a **Lúcião Barbearia**, uma barbearia real de Palmeira d'Oeste – SP. O cliente vê os serviços, os horários e o endereço, escolhe dia e horário e envia o pedido de agendamento pelo WhatsApp.

> Projeto em andamento: o site ainda não está publicado.

## Por que este projeto existe

- **Dar um endereço na internet para um negócio local.** O site reúne em um lugar o que o cliente precisa para decidir: serviços, horários, endereço e contato.
- **Facilitar o agendamento sem mudar a rotina do barbeiro.** O formulário não envia nada para servidor: ele valida o pedido, monta a mensagem e abre o WhatsApp. O Lúcião continua confirmando cada horário manualmente, como já fazia.
- **Ser simples de manter.** Sem framework, sem banco de dados e sem login. São três arquivos (HTML, CSS e JavaScript) mais o Bootstrap, que qualquer hospedagem estática consegue servir.
- **Funcionar para todo mundo.** O site tem um painel de acessibilidade próprio e continua utilizável com JavaScript desligado.
- **Ser honesto.** Nada de preços inventados, avaliações falsas ou contadores de clientes. Só entra no site o que o dono confirmou.

## O que o site faz

- Agendamento pelo WhatsApp com validação de data e horário de acordo com o funcionamento da barbearia.
- Atalhos de dia e de horário, e um resumo do pedido antes de enviar.
- Indicador de aberto ou fechado, com o próximo horário de abertura ou fechamento.
- Folgas e dias sem atendimento, que podem vir de uma planilha do Google editada pelo próprio barbeiro no celular.
- Painel de acessibilidade: alto contraste, tamanho do texto, fonte de leitura facilitada, destaque de links, pausa das animações, cursor maior, guia de leitura, leitura em voz alta e Libras (VLibras).
- Mapa carregado só quando a pessoa clica, e um aviso de privacidade que lista os serviços de terceiros usados.
- Animações de entrada e de rolagem que respeitam a preferência de movimento reduzido.

## Tecnologias

- HTML, CSS e JavaScript puro
- Bootstrap 5.3.3 (via CDN, com verificação de integridade)
- Google Fonts (Montserrat, Oswald e Playfair Display)

## Como rodar

Não há instalação nem build. Abra o `index.html` no navegador ou sirva a pasta:

```
python3 -m http.server 8000
```

Depois acesse `http://localhost:8000`.

## O que aprendi

- **Um site bonito não basta para gerar agendamentos.** O cliente de um negócio local precisa achar rápido o horário, o endereço e o jeito de marcar. Isso pesou mais nas decisões do que os efeitos visuais.
- **Animação precisa de limite.** Usei `IntersectionObserver` e transições CSS no lugar de cálculos a cada evento de rolagem, e toda animação respeita `prefers-reduced-motion` e a opção de pausar do próprio site.
- **O conteúdo não pode depender do JavaScript para aparecer.** As animações de entrada só escondem os elementos quando o script está ativo. Se ele falhar, a página continua legível.
- **Acessibilidade é parte do projeto, não um extra.** Navegação por teclado, atributos ARIA, contraste, link para pular ao conteúdo e mensagens de erro ligadas aos campos do formulário.
- **Recursos do navegador podem falhar.** O acesso ao `localStorage`, à área de transferência e à rede fica protegido, para que uma preferência visual ou uma planilha fora do ar não derrube o resto da página.
- **Validar com regras do negócio.** O formulário confere dia da semana, horário de funcionamento, folgas e horários que já passaram, e explica o motivo quando recusa um pedido.
- **Privacidade (LGPD) na prática.** O mapa do Google só é carregado depois do clique, o site não guarda dados de quem visita, e o aviso de privacidade diz quais terceiros recebem dados de conexão.
- **Segurança em site estático também importa.** Hashes de integridade (SRI) nos arquivos do CDN, uma política de segurança de conteúdo e cabeçalhos contra o uso da página dentro de outro site.
- **Trabalhar com um cliente real.** Esperar a confirmação do dono para preços, serviços e fotos em vez de preencher com dados fictícios, e pensar em como ele mesmo atualiza as folgas sem depender de mim.

## Próximos passos

- Preços dos serviços, quando o dono enviar.
- Fotos novas e galeria de cortes.
- Localização exata no mapa.
- Publicação com domínio próprio e HTTPS.
