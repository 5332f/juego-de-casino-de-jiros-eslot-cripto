document.addEventListener('DOMContentLoaded', () => {
    const symbols = ['🍒', '🍋', '🍇', '🍉', '💎', '7️⃣'];
    let balance = 0;
    let betAmount = 0.1;
    let isSpinning = false;
    let web3;
    let userAddress;
    let contract;

    const contractAddress = '0x1234567890123456789012345678901234567890'; // Reemplaza con la dirección del contrato real
    const contractABI = [
        // Añade el ABI de tu contrato desplegado aquí
    ];

    const balanceElement = document.getElementById('balance');
    const resultElement = document.getElementById('result');
    const spinButton = document.getElementById('spinButton');
    const reels = document.querySelectorAll('.reel .symbol');
    const betAmountElement = document.getElementById('betAmount');
    const connectWalletButton = document.getElementById('connectWallet');
    const userInfoElement = document.getElementById('userInfo');
    const usernameElement = document.getElementById('username');
    const connectedAddressElement = document.getElementById('connectedAddress');
    const amountInput = document.getElementById('amount');
    const depositButton = document.getElementById('depositButton');
    const withdrawButton = document.getElementById('withdrawButton');
    const transactionResultElement = document.getElementById('transactionResult');

    async function connectWallet() {
        if (typeof window.ethereum !== 'undefined') {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                web3 = new Web3(window.ethereum);
                
                const chainId = await web3.eth.getChainId();
                if (chainId !== 56) { // BNB Smart Chain mainnet
                    try {
                        await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: '0x38' }],
                        });
                    } catch (switchError) {
                        if (switchError.code === 4902) {
                            try {
                                await window.ethereum.request({
                                    method: 'wallet_addEthereumChain',
                                    params: [{
                                        chainId: '0x38',
                                        chainName: 'BNB Smart Chain',
                                        nativeCurrency: {
                                            name: 'BNB',
                                            symbol: 'BNB',
                                            decimals: 18
                                        },
                                        rpcUrls: ['https://bsc-dataseed.binance.org/'],
                                        blockExplorerUrls: ['https://bscscan.com/']
                                    }],
                                });
                            } catch (addError) {
                                console.error('Failed to add BNB Smart Chain', addError);
                                return;
                            }
                        } else {
                            console.error('Failed to switch to BNB Smart Chain', switchError);
                            return;
                        }
                    }
                }
                
                const accounts = await web3.eth.getAccounts();
                if (accounts.length > 0) {
                    userAddress = accounts[0];
                    contract = new web3.eth.Contract(contractABI, contractAddress);
                    updateUIAfterWalletConnect();
                    await updateBalance();
                }
            } catch (error) {
                console.error('Failed to connect wallet:', error);
            }
        } else {
            console.log('Please install MetaMask!');
            alert('Please install MetaMask to use this casino!');
        }
    }

    function updateUIAfterWalletConnect() {
        connectWalletButton.classList.add('hidden');
        userInfoElement.classList.remove('hidden');
        usernameElement.textContent = `User: ${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
        connectedAddressElement.textContent = userAddress;
    }

    async function updateBalance() {
        if (userAddress && contract) {
            try {
                balance = await contract.methods.getPlayerBalance(userAddress).call();
                balance = web3.utils.fromWei(balance, 'ether');
                balanceElement.textContent = `Balance: ${parseFloat(balance).toFixed(4)} BNB`;
                balanceElement.classList.add('balance-update');
                setTimeout(() => balanceElement.classList.remove('balance-update'), 500);
            } catch (error) {
                console.error('Failed to update balance:', error);
            }
        }
    }

    function updateBetAmount() {
        betAmountElement.textContent = `${betAmount.toFixed(3)} BNB`;
        spinButton.textContent = `Spin (${betAmount.toFixed(3)} BNB)`;
    }

    async function spin() {
        if (!userAddress || !contract) {
            alert('Please connect your wallet first!');
            return;
        }

        if (parseFloat(balance) < betAmount) {
            resultElement.textContent = "Insufficient balance!";
            resultElement.style.color = "#ff0000";
            return;
        }

        try {
            isSpinning = true;
            spinButton.disabled = true;
            resultElement.textContent = "Spinning...";
            resultElement.style.color = "#ffffff";

            reels.forEach(reel => {
                reel.style.animation = 'none';
                reel.offsetHeight; // Trigger reflow
                reel.style.animation = 'spin 0.5s infinite linear';
            });

            const betAmountWei = web3.utils.toWei(betAmount.toString(), 'ether');
            const transaction = await contract.methods.spin(betAmountWei).send({ from: userAddress });
            console.log('Spin transaction successful:', transaction);

            const spinEvent = transaction.events.Spin;
            const winAmount = web3.utils.fromWei(spinEvent.returnValues.winAmount, 'ether');

            await updateBalance();

            let spins = 0;
            const maxSpins = 20;
            const spinInterval = setInterval(() => {
                spins++;
                if (spins >= maxSpins) {
                    clearInterval(spinInterval);
                    reels.forEach(reel => {
                        reel.style.animation = 'none';
                        reel.textContent = symbols[Math.floor(Math.random() * symbols.length)];
                    });
                    
                    if (parseFloat(winAmount) > 0) {
                        resultElement.textContent = `You won ${parseFloat(winAmount).toFixed(3)} BNB!`;
                        resultElement.style.color = "#00ff00";
                    } else {
                        resultElement.textContent = "Try again!";
                        resultElement.style.color = "#ffffff";
                    }

                    isSpinning = false;
                    spinButton.disabled = false;
                }
            }, 100);
        } catch (error) {
            console.error('Failed to spin:', error);
            resultElement.textContent = "Error occurred!";
            resultElement.style.color = "#ff0000";
            isSpinning = false;
            spinButton.disabled = false;
        }
    }

    async function deposit() {
        if (!userAddress || !contract) {
            alert('Please connect your wallet first!');
            return;
        }

        const amount = amountInput.value;
        if (parseFloat(amount) < 0.001 || parseFloat(amount) > 1) {
            alert('Deposit amount must be between 0.001 and 1 BNB!');
            return;
        }

        try {
            const amountWei = web3.utils.toWei(amount, 'ether');
            await contract.methods.deposit().send({ from: userAddress, value: amountWei });
            transactionResultElement.textContent = "Deposit successful!";
            await updateBalance();
        } catch (error) {
            console.error('Failed to deposit:', error);
            transactionResultElement.textContent = "Deposit failed!";
        }
    }

    async function withdraw() {
        if (!userAddress || !contract) {
            alert('Please connect your wallet first!');
            return;
        }

        const amount = amountInput.value;
        if (parseFloat(amount) < 0.001 || parseFloat(amount) > 1) {
            alert('Withdrawal amount must be between 0.001 and 1 BNB!');
            return;
        }

        try {
            const amountWei = web3.utils.toWei(amount, 'ether');
            await contract.methods.withdraw(amountWei).send({ from: userAddress });
            transactionResultElement.textContent = "Withdrawal successful!";
            await updateBalance();
        } catch (error) {
            console.error('Failed to withdraw:', error);
            transactionResultElement.textContent = "Withdrawal failed!";
        }
    }

    function decreaseBet() {
        if (betAmount > 0.001) {
            betAmount -= 0.01;
            updateBetAmount();
        }
    }

    function increaseBet() {
        if (betAmount < 1) {
            betAmount += 0.01;
            updateBetAmount();
        }
    }

    function doubleBet() {
        if (betAmount * 2 <= 1) {
            betAmount *= 2;
            updateBetAmount();
        }
    }

    connectWalletButton.addEventListener('click', connectWallet);
    depositButton.addEventListener('click', deposit);
    withdrawButton.addEventListener('click', withdraw);
    spinButton.addEventListener('click', spin);
    document.getElementById('decreaseBet').addEventListener('click', decreaseBet);
    document.getElementById('increaseBet').addEventListener('click', increaseBet);
    document.getElementById('doubleBet').addEventListener('click', doubleBet);

    updateBetAmount();
});
