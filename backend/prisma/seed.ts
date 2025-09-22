import { initializeDatabase } from '../scripts/init-database'

async function main() {
  console.log('Starting database seed...')
  
  // Executar inicialização completa da base de dados
  await initializeDatabase()

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })