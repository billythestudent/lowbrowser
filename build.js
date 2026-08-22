const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔮 LowBrowser derleniyor (electron-builder & ASAR binary paketleme)...');

try {
  // 1. Run electron-builder package process
  execSync('npx electron-builder', { stdio: 'inherit' });
  console.log('\n✅ Derleme işlemi başarıyla tamamlandı!');

  // 2. Locate generated installer
  const distDir = path.join(__dirname, 'dist');
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    
    // Find installer files (ends with .exe)
    const installerFiles = files
      .filter(f => f.endsWith('.exe'))
      .map(f => {
        const filePath = path.join(distDir, f);
        return {
          name: f,
          path: filePath,
          time: fs.statSync(filePath).mtime.getTime()
        };
      });

    installerFiles.sort((a, b) => b.time - a.time);

    console.log(`\n📂 dist klasöründe derlenen yükleyici:`);
    installerFiles.forEach(f => console.log(`   📦 ${f.name}`));

    console.log('\n🚀 GİTHUB RELEASES SÜRÜMÜ YAYINLAMA REHBERİ:');
    console.log('1. GitHub tarayıcınızda şu adrese gidin:');
    console.log('   🔗 https://github.com/billythestudent/lowbrowser/releases/new');
    console.log('2. Versiyon etiketini yazın (Örn: v1.0.0)');
    console.log(`3. dist/ klasöründeki "LowBrowser-Setup.exe" dosyasını sürükleyip bırakın.`);
    console.log('4. "Publish release" butonuna basın.');
    console.log('\n✨ Sitenizdeki indirme linki artık en son yayınladığınız bu sürümü otomatik dağıtacaktır!');
  }
} catch (error) {
  console.error('\n❌ Derleme sırasında hata oluştu:', error.message);
  process.exit(1);
}
