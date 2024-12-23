document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const username = '{{ username }}'; // Obtenez le pseudo de l'utilisateur depuis Flask
    const isModerator = username.startsWith('MODO'); // Vérifiez si l'utilisateur est un modérateur

    const forbiddenWords = [];
    const commands = {
        '/time': 'Affiche l\'heure actuelle',
        '/joke': 'Affiche une blague',
        '/weather': 'Affiche la météo fictive',
        '/help': 'Affiche la liste des commandes disponibles',
        '/quote': 'Affiche une citation motivante',
        '/createpoll': 'Créer un sondage',
        '/fact': 'Affiche un fait intéressant',
        '/motivate': 'Affiche un message motivant',
        '/advice': 'Affiche un conseil aléatoire',
        '/trivia': 'Affiche une question de trivia'
    };

    socket.on('message', (data) => {
        const messages = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.innerHTML = `${data.message}`;
        
        // Ajoutez le lien de suppression si l'utilisateur est un modérateur
        if (isModerator) {
            messageElement.innerHTML += ` <a href="#" onclick="deleteMessage(${data.message_id})">delete msg (FM)</a>`;
        }

        messages.appendChild(messageElement);
        // Défilement automatique vers le bas
        messages.scrollTop = messages.scrollHeight;
    });

    socket.on('new_poll', (poll) => {
        displayPoll(poll, polls.length - 1);
    });

    socket.on('update_poll', (data) => {
        const pollElement = document.getElementById(`poll-${data.poll_index}`);
        if (pollElement) {
            const votes = data.votes.map((vote, index) => `<div>${poll.options[index]}: ${vote}</div>`).join('');
            pollElement.innerHTML = `<div>${poll.question}</div>${votes}`;
        }
    });

    document.getElementById('message').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        } else if (e.key === '/') {
            showCommandSuggestions();
        }
    });

    function showCommandSuggestions() {
        const messageInput = document.getElementById('message');
        const suggestionBox = document.createElement('div');
        suggestionBox.id = 'suggestion-box';
        suggestionBox.style.position = 'absolute';
        suggestionBox.style.backgroundColor = 'white';
        suggestionBox.style.border = '1px solid #ccc';
        suggestionBox.style.width = '200px';
        suggestionBox.style.zIndex = '1000';

        Object.keys(commands).forEach(command => {
            const suggestionItem = document.createElement('div');
            suggestionItem.textContent = `${command} - ${commands[command]}`;
            suggestionItem.style.padding = '5px';
            suggestionItem.style.cursor = 'pointer';

            suggestionItem.addEventListener('click', () => {
                messageInput.value = command;
                document.body.removeChild(suggestionBox);
            });

            suggestionBox.appendChild(suggestionItem);
        });

        document.body.appendChild(suggestionBox);

        // Position the suggestion box
        const rect = messageInput.getBoundingClientRect();
        suggestionBox.style.left = `${rect.left}px`;
        suggestionBox.style.top = `${rect.bottom}px`;

        // Remove the suggestion box when clicking outside of it
        document.addEventListener('click', (event) => {
            if (event.target !== suggestionBox && !suggestionBox.contains(event.target) && event.target !== messageInput) {
                if (document.body.contains(suggestionBox)) {
                    document.body.removeChild(suggestionBox);
                }
            }
        });
    }

    window.deleteMessage = function (message_id) {
        fetch('/delete_message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message_id })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert('Failed to delete message');
            }
        });
    };

    window.createPoll = function () {
        const question = prompt("Entrez la question du sondage:");
        const options = prompt("Entrez les options séparées par des virgules:").split(',');
        fetch('/create_poll', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ question, options })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert('Failed to create poll');
            }
        });
    };

    window.vote = function (poll_index, option_index) {
        fetch('/vote', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ poll_index, option_index })
        })
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                alert('Failed to vote');
            }
        });
    };

    function displayPoll(poll, poll_index) {
        const pollsContainer = document.getElementById('polls');
        const pollElement = document.createElement('div');
        pollElement.id = `poll-${poll_index}`;
        const options = poll.options.map((option, index) => `<button onclick="vote(${poll_index}, ${index})">${option}</button>`).join('');
        pollElement.innerHTML = `<div>${poll.question}</div>${options}`;
        pollsContainer.appendChild(pollElement);
    }

    function sendMessage() {
        const messageInput = document.getElementById('message');
        const message = messageInput.value.trim(); // Supprime les espaces en début et fin de chaîne

        // Vérifiez si le message est vide
        if (message === '') {
            alert('Le message ne peut pas être vide.');
            return;
        }

        // Automodération : vérifier les mots interdits
        for (let word of forbiddenWords) {
            if (message.includes(word)) {
                alert('Votre message contient des mots interdits.');
                messageInput.value = '';
                return;
            }
        }

        // Commande spéciale pour afficher l'heure
        if (message === '/time') {
            const currentTime = new Date().toLocaleTimeString();
            alert(`Heure actuelle: ${currentTime}`);
            messageInput.value = '';
            return;
        }

        // Commande spéciale pour afficher une blague
        if (message === '/joke') {
            const joke = "Pourquoi les plongeurs plongent-ils toujours en arrière et jamais en avant ? Parce que sinon ils tombent toujours dans le bateau !";
            alert(`Blague: ${joke}`);
            messageInput.value = '';
            return;
        }

        // Envoyez le message avec le pseudo de l'utilisateur
        socket.send(`${message}`);
        messageInput.value = '';
    }
});
