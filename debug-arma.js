// Script de depuração para testar o sistema de armas
// Execute no console do FoundryVTT para verificar o funcionamento

console.log("=== DEBUG SISTEMA DE ARMAS ===");

// 1. Verificar se o modelo de dados está registrado
console.log("Modelo de dados registrados:");
console.log("CONFIG.Item.dataModels:", CONFIG.Item.dataModels);
console.log("Modelo CardiganSystemArma:", CONFIG.Item.dataModels.arma);

// 2. Verificar se o sheet está registrado
console.log("Sheets registrados:");
console.log("Items.registeredSheets:", Items.registeredSheets);

// 3. Verificar se consegue criar um item de arma
async function testarCriacaoArma() {
  try {
    console.log("Tentando criar item de arma...");
    
    // Pegar o primeiro ator disponível ou usar um específico
    const actor = game.actors.contents[0];
    if (!actor) {
      console.error("Nenhum ator disponível para teste");
      return;
    }
    
    console.log("Ator selecionado:", actor.name);
    
    // Criar item de arma
    const armaData = {
      name: "Espada de Teste",
      type: "arma",
      system: {
        damage: {
          value: "1d8",
          type: "cortante"
        },
        weaponType: "corpo-a-corpo",
        equipped: false,
        weight: 2,
        price: 100
      }
    };
    
    const novaArma = await actor.createEmbeddedDocuments("Item", [armaData]);
    console.log("Arma criada com sucesso:", novaArma[0]);
    
    // Tentar abrir o sheet
    console.log("Tentando abrir sheet da arma...");
    const sheet = novaArma[0].sheet;
    console.log("Sheet da arma:", sheet);
    console.log("Classe do sheet:", sheet.constructor.name);
    
    // Verificar se o sheet pode ser renderizado
    console.log("Tentando renderizar sheet...");
    sheet.render(true);
    
    return novaArma[0];
    
  } catch (error) {
    console.error("Erro ao criar/testar arma:", error);
    console.error("Stack trace:", error.stack);
  }
}

// 4. Função para testar abertura de sheet existente
function testarAbrirSheet(itemId) {
  try {
    const item = game.items.get(itemId) || game.actors.contents.flatMap(a => a.items.contents).find(i => i.id === itemId);
    if (!item) {
      console.error("Item não encontrado:", itemId);
      return;
    }
    
    console.log("Item encontrado:", item);
    console.log("Tipo do item:", item.type);
    console.log("Sheet do item:", item.sheet);
    
    item.sheet.render(true);
    
  } catch (error) {
    console.error("Erro ao abrir sheet:", error);
  }
}

// Executar testes automaticamente
console.log("Executando teste de criação de arma...");
testarCriacaoArma();

// Exportar funções para uso manual
window.debugArma = {
  testarCriacaoArma,
  testarAbrirSheet
};

console.log("Funções de debug disponíveis:");
console.log("- debugArma.testarCriacaoArma()");
console.log("- debugArma.testarAbrirSheet(itemId)");
