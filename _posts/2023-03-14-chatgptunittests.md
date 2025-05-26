---
title: 'Using ChatGPT to Write Code'
date: 2023-03-14
permalink: /posts/2023/03/chatgptunittests/
tags:
  - education
  - technical
---

I've been asked occasionally about my opinion about generative AI tools such as Chat GPT and their potential to disrupt the way we design and create.  While I think there is a risk that fundamental knowledge and skill may erode as they are abstracted away by tools like these, I also think these tools create wonderful "jumping off points" for prototyping ideas.  We still need a technically educated population to a) know what questions to ask, b) ask them in a precise way, and c) validate the results.

So I propose that we acknowledge these as guidance systems, and provide some mentorship and coaching regarding the risks in using them, and ways to mitigate that risk.  In particular, I see an opportunity to motivate and to teach software testing as even more critical as we rely more heavily on automatically generated code (or, for that matter, code that one finds from anonymous sources on the Internet!).

To try this out, I provided the following prompt to ChatGPT: 

```
Write a python program that extracts N bits from an IPv4 address given a netmask N
```

And I got the following response:

```python
def extract_bits(ip_address, netmask_bits):
    # Convert IP address to a list of integers
    ip_list = [int(x) for x in ip_address.split(".")]

    # Create a binary string of the netmask
    netmask = "1" * netmask_bits + "0" * (32 - netmask_bits)

    # Convert the binary netmask to a list of integers
    netmask_list = [int(netmask[i:i+8], 2) for i in range(0, 32, 8)]

    # Apply the netmask to the IP address
    masked_ip = [ip_list[i] & netmask_list[i] for i in range(4)]

    # Convert the masked IP address to a binary string
    masked_ip_str = "".join(format(byte, "08b") for byte in masked_ip)

    # Extract the first N bits from the masked IP address
    extracted_bits = masked_ip_str[:netmask_bits]

    # Convert the extracted bits to an integer
    extracted_int = int(extracted_bits, 2)

    return extracted_int
```

It even provided me with an example on how to invoke this function:

```python
# In this example, the function extracts the first 24 bits (corresponding to the first three octets) from the IP address "192.168.1.100" using a netmask of 24 bits. The resulting value is 192.

ip_address = "192.168.1.100"
netmask_bits = 24
extracted_bits = extract_bits(ip_address, netmask_bits)
print(extracted_bits)  # Output: 192
```

Pretty impressive, even if it is simply mining the Internet for text to synthesize as a response.  The problem is that it is not clear that this program is generating the correct output.  When I call this function according to the example it gave, I get `12625921` as the output.  Incidentally, that's `0b0b110000001010100000000001` in binary.  That does correspond to the first 24 bits of the address.  But the comment says to expect the output to be 192, which is not quite right.  Even still, it would be nice to report the network address in the typical `a.b.c.d` format, or at least as a list of octets, such as `[192, 168, 1, 0]`.  Perhaps this was the result of ambiguity in the question I posed to ChatGPT, but regardless, I'm curious as to whether we could continue to use ChatGPT prompts to finish this program.

I decided to ask ChatGPT to write another program to help me to do this, by converting a 32-bit integer (that the original function was returning to me) into a list of 4 octets, like a typical IPv4 network address:

```
Write a program to convert an integer containing 32 bits to a list of four 8-bit values in python
```

To which it wrote:

```python
def int_to_bytes(n):
    # Convert integer to binary string
    binary_str = format(n, "032b")

    # Split binary string into four 8-bit chunks
    byte_strs = [binary_str[i:i+8] for i in range(0, 32, 8)]

    # Convert each 8-bit chunk to an integer
    bytes = [int(byte_str, 2) for byte_str in byte_strs]

    return bytes
```

It provided the following example invocation:

```python
# In this example, the function converts the integer 4278190080 to a binary string ("11111111000000000000000011111111") and then splits it into four 8-bit chunks ("11111111", "00000000", "00000000", and "11111111"). Finally, it converts each 8-bit chunk to an integer ([255, 0, 0, 255]). The resulting value is a list of four 8-bit values that represent the number 4278190080 in binary.

n = 4278190080
bytes = int_to_bytes(n)
print(bytes)  # Output: [255, 0, 0, 255]
```    

Interesting, it got the comment wrong in the example again.  `[255, 0, 0, 0]` is the expected output for this example.

To combine these two programs, I called `int_to_bytes` from the original `extract_bits` function, right before the return statement.  To do this, I had to shift the network address to the left, since the network address bits are the uppermost bits of an IPv4 address.  Then, I called `int_to_bytes` with this resulting value.  Although I did this manually, I think it would be an interesting assignment to ask students to continue to prompt ChatGPT until it came up with this solution, sort of like a coding version of the game "Taboo."  Here's the solution, now ask the right question to get an AI to generate it.  It's a little more challenging that it sounds.  For example, one wouldn't know to ask the AI to shift the bits of the network address without an understanding of IP address formats. 

```python
    # PAD 0's ON THE LEAST SIGNIFICANT (COMPUTER ADDRESS) BITS
    extracted_int = extracted_int << (32 - netmask_bits)
        
    # CONVERT BACK TO OCTETS
    extracted_int = int_to_bytes(extracted_int)
```

Additionally, we should take care to validate this program.  We always say this is a best practice, but students are usually pretty confident in their solutions.  Perhaps they'd be more convinced that some arbitrary code shouldn't be trusted, especially if the output does not make sense, and if it does not align with the generated comment.  Another fun exercise is to generate unit tests for AI generated code, and to revise the prompts until the tests pass.  Using `pytest`, here are a few brief tests for the code that my prompts generated here:

```python
# pip install pytest
# run with: pytest

from to_octets import int_to_bytes 
from netmask2 import extract_bits 

def test_netmask():
    assert extract_bits("192.168.1.100", 24) == [192, 168, 1, 0]

def test_int_to_bytes():
    assert int_to_bytes(4278190080) == [255, 0, 0, 0]
```

Impressively, ChatGPT got this program nearly correct on the first prompt.  However, it took a little massaging to get things quite right.  This is arguably due to unclear wording in the question itself, but that's the point: how would you know?  Beyond this, the commenting of the code itself wasn't quite right, which doesn't inspire confidence!  I think this leads to a fun game, of sorts, in which you propose a problem statement, ask an AI to generate a solution, test it, and refine the prompt.  There's a lot to learn about how these generative AI systems work, about how we can leverage them in healthy ways, and, perhaps most importantly, about the limitations of these systems and how the "human-in-the-loop" is expected to contribute to the solution.
