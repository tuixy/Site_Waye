from flask import Flask, render_template, redirect, url_for, request, jsonify
from flask_socketio import SocketIO, send, emit
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
import os

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

messages = []
polls = []
users = {}

class User(UserMixin):
    def __init__(self, id):
        self.id = id

@login_manager.user_loader
def load_user(user_id):
    return User(user_id)

def read_users():
    if os.path.exists('bdd.txt'):
        with open('bdd.txt', 'r') as file:
            for line in file:
                username, email, password = line.strip().split(',')
                users[username] = {'username': username, 'email': email, 'password': password}

def write_user(username, email, password):
    with open('bdd.txt', 'a') as file:
        file.write(f'{username},{email},{password}\n')

def log_message(message):
    with open('logs.txt', 'a') as file:
        file.write(message + '\n')

def log_location(ip, latitude, longitude):
    with open('location_logs.txt', 'a') as file:
        file.write(f"IP: {ip}, Latitude: {latitude}, Longitude: {longitude}\n")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        if username in users and users[username]['password'] == password:
            user = User(username)
            login_user(user)
            return redirect(url_for('chat'))
    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']
        if username not in users:
            users[username] = {'username': username, 'email': email, 'password': password}
            write_user(username, email, password)
            user = User(username)
            login_user(user)
            return redirect(url_for('chat'))
    return render_template('signup.html')

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('login'))

@app.route('/images/<path:filename>')
def send_image(filename):
    return send_from_directory('images', filename)

@app.route('/acceuil')
def chat():
    return render_template('index.html', username=current_user.id)

@app.route('/survey')
@login_required
def survey():
    return render_template('survey.html')

@app.route('/submit_survey', methods=['POST'])
@login_required
def submit_survey():
    username = current_user.id
    responses = read_responses()
    
    # Vérifie si l'utilisateur a déjà répondu
    if any(username in response for response in responses):
        return jsonify({'message': 'Vous avez déjà répondu au sondage.'})
    
    answers = []
    for key, value in request.form.items():
        answers.append(f'{key}:{value}')
    
    response = f'{username},' + ','.join(answers)
    write_response(response)
    
    return jsonify({'message': 'Merci pour votre participation!'})

@app.route('/create_poll', methods=['POST'])
@login_required
def create_poll():
    question = request.json.get('question')
    options = request.json.get('options')
    poll = {'question': question, 'options': options, 'votes': [0] * len(options)}
    polls.append(poll)
    emit('new_poll', poll, broadcast=True)
    return jsonify(success=True)

@app.route('/vote', methods=['POST'])
@login_required
def vote():
    poll_index = request.json.get('poll_index')
    option_index = request.json.get('option_index')
    polls[poll_index]['votes'][option_index] += 1
    emit('update_poll', {'poll_index': poll_index, 'votes': polls[poll_index]['votes']}, broadcast=True)
    return jsonify(success=True)

@app.route('/log_location', methods=['POST'])
def log_location_route():
    data = request.get_json()
    ip = data.get('ip')
    latitude = data.get('latitude')
    longitude = data.get('longitude')
    log_location(ip, latitude, longitude)
    return jsonify({'message': 'Position et IP enregistrées avec succès !'})

@socketio.on('message')
def handleMessage(msg):
    message = f"{current_user.id}: {msg}"
    messages.append(message)
    log_message(message)
    send({'message': message, 'message_id': len(messages)-1}, broadcast=True)

if __name__ == '__main__':
    read_users()
    socketio.run(app, debug=True)
