"""Smoke-test de connexion Modal : `modal run get_started.py` -> « the square is 1764 ».

Sert uniquement à vérifier que `python3 -m modal setup` a bien configuré le token.
Le vrai service Ciceron est dans agents/modal_app.py.
"""
import modal

app = modal.App("example-get-started")


@app.function()
def square(x):
    print("This code is running on a remote worker!")
    return x**2


@app.local_entrypoint()
def main():
    print("the square is", square.remote(42))
