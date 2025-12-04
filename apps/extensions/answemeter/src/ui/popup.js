// Google Docs Offline - Popup Script

document.addEventListener('DOMContentLoaded', async () => {
  // Display version from manifest
  const manifest = chrome.runtime.getManifest();
  document.getElementById('version').textContent = manifest.version;
  
  // Show last update time
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  document.getElementById('updateTime').textContent = `Loaded at ${timeStr}`;
  
  // Load saved configuration
  const config = await chrome.storage.local.get(['apiKey', 'model']);
  
  // Set form values
  if (config.apiKey) {
    document.getElementById('apiKey').value = config.apiKey;
  }
  
  if (config.model) {
    document.getElementById('model').value = config.model;
  } else {
    document.getElementById('model').value = 'gpt-4o';
  }
  
  // Check status
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    if (currentTab.url && currentTab.url.includes('learn.microsoft.com')) {
      statusIndicator.classList.remove('inactive');
      statusText.textContent = 'Active on MS Learn';
    } else {
      statusIndicator.classList.add('inactive');
      statusText.textContent = 'Ready';
    }
  });
  
  // Save configuration
  document.getElementById('saveConfig').addEventListener('click', async () => {
    const apiKey = document.getElementById('apiKey').value;
    const model = document.getElementById('model').value;
    
    if (!apiKey) {
      showStatus('⚠️ Please enter an API key', 'error');
      return;
    }
    
    await chrome.storage.local.set({ apiKey, model });
    
    // Notify background script to reload config
    chrome.runtime.sendMessage({ action: 'reloadConfig' });
    
    showStatus('✅ Configuration saved!', 'success');
  });
  
  // Test connection
  document.getElementById('testConnection').addEventListener('click', async () => {
    showStatus('🔄 Testing connection...', 'info');
    
    const response = await chrome.runtime.sendMessage({ action: 'testConnection' });
    
    if (response.success) {
      showStatus('✅ Connection successful!', 'success');
    } else {
      showStatus('❌ Connection failed: ' + response.error, 'error');
    }
  });
});

function showStatus(message, type) {
  const statusDiv = document.getElementById('connectionStatus');
  statusDiv.textContent = message;
  statusDiv.style.display = 'block';
  statusDiv.style.color = type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#667eea';
  
  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
}
