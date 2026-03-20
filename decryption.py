import pandas as pd
from cryptography.fernet import Fernet

#keyDirectory = 'C:\\Users\\jvineet\\Documents\\Github3\\dev_python\\Data\\metadata\\secret_prod.key'


def decryptData(data, keyDirectory):

    scKey = open(keyDirectory, 'rb').read()
    cipherSuite = Fernet(scKey)
    if isinstance(data, str):
        return cipherSuite.decrypt(data.encode()).decode()
    else:
        return data


