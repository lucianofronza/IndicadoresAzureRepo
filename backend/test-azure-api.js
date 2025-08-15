const axios = require('axios');

async function testAzureAPIs() {
  console.log('🔍 Testando URLs da API do Azure DevOps...');
  
  const token = process.env.AZURE_PERSONAL_ACCESS_TOKEN;
  const organization = 'bennertec';
  const project = 'BServer';
  const prId = 229; // PR que estava dando erro
  
  if (!token) {
    console.log('❌ Token do Azure DevOps não configurado');
    return;
  }
  
  const headers = {
    'Authorization': `Basic ${Buffer.from(`:${token}`).toString('base64')}`,
    'Accept': 'application/json',
  };
  
  // Teste 1: URL atual (que está dando 404)
  console.log('\n📝 Teste 1: URL atual');
  const url1 = `https://dev.azure.com/${organization}/${project}/_apis/git/pullrequests/${prId}/threads?api-version=7.0`;
  console.log(`URL: ${url1}`);
  
  try {
    const response1 = await axios.get(url1, { headers, timeout: 10000 });
    console.log('✅ Funcionou!');
    console.log(`Status: ${response1.status}`);
    console.log(`Dados: ${JSON.stringify(response1.data, null, 2)}`);
  } catch (error) {
    console.log('❌ Falhou');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Erro: ${error.response?.data?.message || error.message}`);
  }
  
  // Teste 2: URL alternativa (com repository ID)
  console.log('\n📝 Teste 2: URL com repository ID');
  const url2 = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/BServer/pullrequests/${prId}/threads?api-version=7.0`;
  console.log(`URL: ${url2}`);
  
  try {
    const response2 = await axios.get(url2, { headers, timeout: 10000 });
    console.log('✅ Funcionou!');
    console.log(`Status: ${response2.status}`);
    console.log(`Dados: ${JSON.stringify(response2.data, null, 2)}`);
  } catch (error) {
    console.log('❌ Falhou');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Erro: ${error.response?.data?.message || error.message}`);
  }
  
  // Teste 3: URL com repository GUID
  console.log('\n📝 Teste 3: URL com repository GUID');
  const url3 = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/1852537c-c6f5-4ae5-bba9-45d9244c736a/pullrequests/${prId}/threads?api-version=7.0`;
  console.log(`URL: ${url3}`);
  
  try {
    const response3 = await axios.get(url3, { headers, timeout: 10000 });
    console.log('✅ Funcionou!');
    console.log(`Status: ${response3.status}`);
    console.log(`Dados: ${JSON.stringify(response3.data, null, 2)}`);
  } catch (error) {
    console.log('❌ Falhou');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Erro: ${error.response?.data?.message || error.message}`);
  }
  
  // Teste 4: URL alternativa para reviews
  console.log('\n📝 Teste 4: URL para reviews');
  const url4 = `https://dev.azure.com/${organization}/${project}/_apis/git/pullrequests/${prId}/reviews?api-version=7.0`;
  console.log(`URL: ${url4}`);
  
  try {
    const response4 = await axios.get(url4, { headers, timeout: 10000 });
    console.log('✅ Funcionou!');
    console.log(`Status: ${response4.status}`);
    console.log(`Dados: ${JSON.stringify(response4.data, null, 2)}`);
  } catch (error) {
    console.log('❌ Falhou');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Erro: ${error.response?.data?.message || error.message}`);
  }
  
  // Teste 5: Listar repositórios para ver a estrutura
  console.log('\n📝 Teste 5: Listar repositórios');
  const url5 = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories?api-version=7.0`;
  console.log(`URL: ${url5}`);
  
  try {
    const response5 = await axios.get(url5, { headers, timeout: 10000 });
    console.log('✅ Funcionou!');
    console.log(`Status: ${response5.status}`);
    console.log('Repositórios:');
    response5.data.value.forEach(repo => {
      console.log(`  - ${repo.name} (ID: ${repo.id})`);
    });
  } catch (error) {
    console.log('❌ Falhou');
    console.log(`Status: ${error.response?.status}`);
    console.log(`Erro: ${error.response?.data?.message || error.message}`);
  }
}

testAzureAPIs().catch(console.error);
